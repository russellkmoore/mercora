import { getCloudflareContext } from '@opennextjs/cloudflare';

import { extractAIResponse, getCurrentEmbeddingModel, runAI } from '@/lib/ai/config';
import type { ReviewModerationSummary } from '@/lib/types';

interface AIModerationPayload {
  title?: string;
  body: string;
  metadata?: Record<string, any>;
}

interface ModerationVectorPattern {
  id: string;
  text: string;
  reason: string;
  severity: 'info' | 'warn' | 'flag' | 'block';
  example?: string;
}

const MODERATION_NAMESPACE = 'moderation';

const MODERATION_PATTERNS: ModerationVectorPattern[] = [
  {
    id: 'moderation:external-link',
    text: 'Check out my store at http://example.com and buy there instead',
    reason: 'contains_external_link',
    severity: 'block',
    example: 'http://',
  },
  {
    id: 'moderation:affiliate-promo',
    text: 'Use my affiliate link to purchase from another retailer',
    reason: 'third_party_promotion',
    severity: 'flag',
  },
  {
    id: 'moderation:malware',
    text: 'Download this cracked software or malicious file',
    reason: 'malicious_content',
    severity: 'block',
  },
  {
    id: 'moderation:hate-speech',
    text: 'Offensive or hateful language targeting a group of people',
    reason: 'hate_speech',
    severity: 'block',
  },
  {
    id: 'moderation:spammy-language',
    text: 'Repeated marketing spam or advertising language for unrelated products',
    reason: 'spammy_content',
    severity: 'flag',
  },
];

let moderationVectorsReady: Promise<void> | null = null;

function mergeUnique(list: string[] | undefined, additions: string[] | undefined): string[] {
  const merged = new Set<string>(list ?? []);
  for (const item of additions ?? []) {
    if (item) merged.add(item);
  }
  return Array.from(merged);
}

function sanitizeJson(text: string): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.warn('Failed to parse AI moderation response', error);
    return null;
  }
}

async function ensureModerationVectors(ai: any, vectorize: any) {
  if (!ai || !vectorize) return;
  if (moderationVectorsReady) {
    return moderationVectorsReady;
  }

  moderationVectorsReady = (async () => {
    try {
      const vectors: any[] = [];
      for (const pattern of MODERATION_PATTERNS) {
        const embedding = await ai.run(getCurrentEmbeddingModel(), { text: pattern.text });
        if (!embedding?.data?.[0]) {
          continue;
        }

        vectors.push({
          id: pattern.id,
          values: embedding.data[0],
          namespace: MODERATION_NAMESPACE,
          metadata: {
            type: MODERATION_NAMESPACE,
            reason: pattern.reason,
            severity: pattern.severity,
            example: pattern.example ?? pattern.text,
          },
        });
      }

      if (vectors.length) {
        await vectorize.upsert(vectors);
      }
    } catch (error) {
      console.error('Failed to seed moderation vector patterns', error);
    }
  })();

  return moderationVectorsReady;
}

async function evaluateWithVectorize(text: string): Promise<Partial<ReviewModerationSummary>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as any)?.AI;
    const vectorize = (env as any)?.VECTORIZE;

    if (!ai || !vectorize) {
      return {};
    }

    await ensureModerationVectors(ai, vectorize);

    const embedding = await ai.run(getCurrentEmbeddingModel(), { text });
    if (!embedding?.data?.[0]) {
      return {};
    }

    const query = await vectorize.query(embedding.data[0], {
      namespace: MODERATION_NAMESPACE,
      topK: 5,
      returnMetadata: true,
    });

    if (!query?.matches?.length) {
      return {};
    }

    const reasons: string[] = [];
    const detected: string[] = [];
    let flagged = false;
    let blocked = false;

    for (const match of query.matches) {
      if (!match?.metadata?.severity || typeof match.score !== 'number') continue;
      if (match.score < 0.72) continue;

      const severity = String(match.metadata.severity);
      const reason = String(match.metadata.reason ?? 'vector_match');
      const example = match.metadata.example ? String(match.metadata.example) : undefined;

      if (severity === 'block') {
        blocked = true;
      }
      if (severity === 'block' || severity === 'flag' || severity === 'warn') {
        flagged = true;
      }

      reasons.push(reason);
      if (example) {
        detected.push(example);
      }
    }

    return {
      flagged,
      blocked,
      reasons: reasons.length ? Array.from(new Set(reasons)) : undefined,
      detectedPhrases: detected.length ? Array.from(new Set(detected)) : undefined,
    };
  } catch (error) {
    console.error('Vector moderation query failed', error);
    return {};
  }
}

export async function analyzeReviewContent(
  payload: AIModerationPayload
): Promise<ReviewModerationSummary | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as any)?.AI;

    if (!ai) {
      return null;
    }

    const reviewText = `Title: ${payload.title ?? '(none)'}\nBody: ${payload.body}`.trim();

    const aiResponse = await runAI(ai, 'MODERATION', {
      messages: [
        {
          role: 'system',
          content:
            'You are a strict content moderation classifier. Return JSON with fields flagged (boolean), blocked (boolean), reasons (array of strings), warnings (array of strings, optional). Flag content that links to other stores, contains ads, hate speech, malware, or policy violations. Block severe violations.',
        },
        {
          role: 'user',
          content: `${reviewText}\nRespond ONLY with JSON.`,
        },
      ],
      maxTokens: 250,
    });

    const aiText = extractAIResponse(aiResponse);
    const parsed = sanitizeJson(aiText ?? '');

    const baseSummary: ReviewModerationSummary = {
      flagged: Boolean(parsed?.flagged),
      blocked: Boolean(parsed?.blocked),
      reasons: Array.isArray(parsed?.reasons) ? parsed.reasons.map(String) : [],
      warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : undefined,
    };

    const vectorSummary = await evaluateWithVectorize(`${payload.title ?? ''} ${payload.body}`.trim());

    const reasons = mergeUnique(baseSummary.reasons, vectorSummary.reasons ?? []);
    const warnings = mergeUnique(baseSummary.warnings, vectorSummary.warnings);

    return {
      flagged: baseSummary.flagged || Boolean(vectorSummary.flagged),
      blocked: baseSummary.blocked || Boolean(vectorSummary.blocked),
      reasons,
      warnings: warnings.length ? warnings : undefined,
      detectedPhrases: vectorSummary.detectedPhrases,
    };
  } catch (error) {
    console.error('AI moderation check failed', error);
    return null;
  }
}
