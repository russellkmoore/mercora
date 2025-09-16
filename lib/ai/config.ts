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
export const EMBEDDING_MODEL: AIModelConfig = {
  model: "@cf/baai/bge-base-en-v1.5",
  temperature: 0, // Not applicable for embeddings
  maxTokens: 0, // Not applicable for embeddings
  description: "BGE Base EN v1.5 - High-quality English embeddings for semantic search"
};

/**
 * Model configurations for specific use cases
 */
export const AI_MODELS = {
  /** For chat/conversational AI (Volt assistant) */
  CHAT: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.1, // Lower temperature for more consistent responses
    maxTokens: 800, // 3x increase: Better product explanations and multi-step recommendations
  },

  /** For business analytics and data analysis */
  ANALYTICS: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.2, // Very low temperature for factual analysis
    maxTokens: 1500, // 3x increase: Deeper insights, trend analysis, and detailed recommendations
  },

  /** For article/knowledge base content generation */
  CONTENT_GENERATION: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.3, // Balanced creativity for informative content
    maxTokens: 4000, // 2x increase: More comprehensive articles with examples and details
  },

  /** For product description generation */
  MARKETING: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.8, // Higher creativity for marketing content
    maxTokens: 2000, // 2x increase: Richer descriptions with use cases and detailed features
  },

  /** For greeting responses */
  GREETING: {
    ...TEXT_GENERATION_MODEL,
    temperature: 0.1, // Consistent friendly greetings
    maxTokens: 200, // Modest increase: More personalized greetings with context
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

/**
 * Helper function to run AI with standardized configuration
 */
export async function runAI(
  ai: any,
  useCase: keyof typeof AI_MODELS,
  options: {
    messages?: any[];
    text?: string;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const config = getAIConfig(useCase);

  // Handle different model parameter formats
  let params: any;

  if (config.model.includes('@cf/openai/')) {
    // OpenAI models (like GPT-OSS-20B) expect 'input' format
    if (options.messages && options.messages.length > 0) {
      // Convert messages to a single input string
      const systemMessage = options.messages.find(m => m.role === 'system')?.content || '';
      const userMessages = options.messages.filter(m => m.role !== 'system');
      const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

      params = {
        instructions: systemMessage,
        input: lastUserMessage,
        max_tokens: options.maxTokens ?? config.maxTokens,
        temperature: options.temperature ?? config.temperature,
      };
    } else {
      params = {
        input: options.text || '',
        max_tokens: options.maxTokens ?? config.maxTokens,
        temperature: options.temperature ?? config.temperature,
      };
    }
  } else {
    // Meta/Llama models expect 'messages' format
    params = {
      ...options,
      max_tokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
    };
  }

  return await ai.run(config.model, params);
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
export function getCurrentEmbeddingModel(): string {
  return EMBEDDING_MODEL.model;
}