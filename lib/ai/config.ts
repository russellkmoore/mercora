/**
 * === Centralized AI Model Configuration ===
 *
 * This file centralizes all AI model configurations used throughout the application.
 * Update the model identifiers here to switch models across all endpoints.
 *
 * Benefits:
 * - Single source of truth for AI model configuration
 * - Easy model switching and testing
 * - Consistent model parameters across the app
 * - Type safety for AI configurations
 */

export interface AIModelConfig {
  /** The Cloudflare AI model identifier */
  model: string;
  /** Default temperature for text generation */
  temperature: number;
  /** Default max tokens for responses */
  maxTokens: number;
  /** Model description for documentation */
  description: string;
}

/**
 * Primary text generation model used for conversational AI, analytics, and content generation
 */
export const TEXT_GENERATION_MODEL: AIModelConfig = {
  model: "@cf/openai/gpt-oss-20b",
  temperature: 0.3,
  maxTokens: 512,
  description: "GPT-OSS-20B - OpenAI's powerful reasoning model for agentic tasks and versatile developer use cases"
};

/**
 * Embedding model used for vectorized search and semantic similarity
 */
export const EMBEDDING_MODEL = {
  model: "@cf/baai/bge-base-en-v1.5",
  temperature: 0, // Not applicable for embeddings
  maxTokens: 0, // Not applicable for embeddings
  description: "BGE Base EN v1.5 - High-quality English embeddings for semantic search"
} as const satisfies AIModelConfig;

/**
 * Model configurations for specific use cases
 */
export const AI_MODELS = {
  /** For chat/conversational AI (Volt assistant) */
  CHAT: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.1, // Lower temperature for more consistent responses
    maxTokens: 400, // Reduced for faster, more concise responses
  },

  /** For business analytics and data analysis */
  ANALYTICS: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.2, // Very low temperature for factual analysis
    maxTokens: 800, // Reduced for faster dashboard loading
  },

  /** For article/knowledge base content generation */
  CONTENT_GENERATION: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.3, // Balanced creativity for informative content
    maxTokens: 2000, // Reduced but still comprehensive
  },

  /** For product description generation */
  MARKETING: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.8, // Higher creativity for marketing content
    maxTokens: 800, // Reduced for faster admin UI
  },

  /** For automated safety and content moderation checks */
  MODERATION: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0, // Deterministic moderation responses
    maxTokens: 300, // Keep responses concise
  },

  /** For greeting responses */
  GREETING: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.1, // Consistent friendly greetings
    maxTokens: 100, // Keep greetings brief
  },

  /** For vectorized search embeddings */
  EMBEDDINGS: EMBEDDING_MODEL,
} as const;

/**
 * Helper function to get AI model configuration by use case
 */
export function getAIConfig(useCase: keyof typeof AI_MODELS): AIModelConfig {
  return AI_MODELS[useCase];
}

export interface AITextMessage {
  role: string;
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface RunAIOptions {
  messages?: readonly AITextMessage[];
  text?: string;
  temperature?: number;
  maxTokens?: number;
}

function nativeChatMessage(message: AITextMessage, index: number): ChatCompletionMessageParam {
  const name = message.name?.trim();
  if (message.role === "system") {
    return { role: "system", content: message.content, ...(name ? { name } : {}) };
  }
  if (message.role === "assistant") {
    return { role: "assistant", content: message.content, ...(name ? { name } : {}) };
  }
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.tool_call_id?.trim() || `history-tool-${index}`,
    };
  }
  return { role: "user", content: message.content, ...(name ? { name } : {}) };
}

/**
 * Helper function to run AI with standardized configuration
 */
export async function runAI(
  ai: CloudflareEnv["AI"],
  useCase: keyof typeof AI_MODELS,
  options: RunAIOptions,
) {
  const config = getAIConfig(useCase);

  if (isEmbeddingModel(config.model)) {
    const text = options.text
      ?? options.messages?.map((message) => message.content).join("\n")
      ?? "";
    return ai.run(EMBEDDING_MODEL.model, { text });
  }

  const messages = options.messages?.length
    ? options.messages.map(nativeChatMessage)
    : [{ role: "user", content: options.text ?? "" } satisfies UserMessage];
  const params: ChatCompletionsMessagesInput = {
    messages,
    max_tokens: options.maxTokens ?? config.maxTokens,
    temperature: options.temperature ?? config.temperature,
  };

  return ai.run("@cf/openai/gpt-oss-20b", params);
}

/**
 * Type guard to check if a model is an embedding model
 */
export function isEmbeddingModel(model: string): boolean {
  return model === EMBEDDING_MODEL.model;
}

/**
 * Get the current primary text generation model identifier
 */
export function getCurrentTextModel(): string {
  return TEXT_GENERATION_MODEL.model;
}

/**
 * Get the current embedding model identifier
 */
export function getCurrentEmbeddingModel(): typeof EMBEDDING_MODEL.model {
  return EMBEDDING_MODEL.model;
}

/**
 * Extract text response from AI model output (handles different response formats)
 */
const MAX_OUTPUT_ITEMS = 100;
const MAX_CONTENT_ITEMS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadableStreamOutput(value: unknown): boolean {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || value.length > MAX_CONTENT_ITEMS) return "";

  const parts: string[] = [];
  for (const part of value) {
    if (!isRecord(part)) continue;
    if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
      parts.push(part.text);
    }
  }
  return parts.join("");
}

function chatCompletionText(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_OUTPUT_ITEMS) return "";
  for (const choice of value) {
    if (!isRecord(choice) || !isRecord(choice.message)) continue;
    const text = contentText(choice.message.content);
    if (text) return text;
  }
  return "";
}

function responsesMessageText(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_OUTPUT_ITEMS) return "";
  const messages: string[] = [];
  for (const item of value) {
    if (!isRecord(item) || item.type !== "message") continue;
    const text = contentText(item.content);
    if (text) messages.push(text);
  }
  return messages.join("");
}

export function extractAIResponse(response: unknown): string {
  try {
    if (isReadableStreamOutput(response) || !isRecord(response)) return "";

    if (typeof response.response === "string") return response.response;

    const completion = chatCompletionText(response.choices);
    if (completion) return completion;

    if (typeof response.output_text === "string") return response.output_text;

    const output = responsesMessageText(response.output);
    if (output) return output;

    if (typeof response.content === "string") return response.content;
    if (typeof response.text === "string") return response.text;
    return "";
  } catch {
    return "";
  }
}
