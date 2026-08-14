import type { CanonicalFacts } from '@/lib/ai/canonical-facts';
import { Money } from '@/lib/money';
import {
  resolveShippingOptions,
  type ResolvedShippingOption,
} from '@/lib/services/shipping-options';
import { getRefundPolicy } from '@/lib/utils/settings';

export type DeterministicCategory =
  | 'contact_email'
  | 'order_status'
  | 'business_address'
  | 'refund_window'
  | 'shipping_rates';

interface CategoryRule {
  category: DeterministicCategory;
  patterns: RegExp[];
  exclude?: RegExp[];
}

export interface DeterministicAnswerDependencies {
  getRefundPolicy: typeof getRefundPolicy;
  resolveShippingOptions: typeof resolveShippingOptions;
}

const DEFAULT_DEPENDENCIES: DeterministicAnswerDependencies = {
  getRefundPolicy,
  resolveShippingOptions,
};

/** First match wins: contact stays ahead of order for "email about my order". */
const RULES: CategoryRule[] = [
  {
    category: 'contact_email',
    patterns: [
      /\b(e-?mail)\b.{0,40}\b(address|support|you|us|team|contact|customer service)\b/i,
      /\b(address|support|contact|reach|get in touch|write|message)\b.{0,40}\b(e-?mail)\b/i,
      /\b(what|whats|what's|which|where|who)\b.{0,30}\b(e-?mail)\b/i,
      /\b(who|where)\b.{0,20}\b(do|should|can|would) i\b.{0,10}\b(e-?mail|contact|reach|write)\b/i,
      /\bhow (do|can|would) i (contact|reach|get in touch with|get a hold of|talk to)\b/i,
      /\b(contact|customer|support|help)\s+(details|info|information)\b/i,
      /\b(speak|talk) to (a |someone in |the )?(human|person|support|customer service|real)\b/i,
    ],
  },
  {
    category: 'order_status',
    patterns: [
      /\bwhere('?s| is| are)\b.{0,20}\b(my|the)\b.{0,20}\border\b/i,
      /\b(track|tracking)\b.{0,20}\b(my |an |the )?(order|package|shipment|parcel)\b/i,
      /\border status\b/i,
      /\b(status|update) (of|on)\b.{0,20}\bmy order\b/i,
      /\b(has|did|have)\b.{0,20}\bmy order\b.{0,20}\b(ship|shipped|sent|arrived|left)\b/i,
      /\bwhen (will|does|is)\b.{0,25}\b(my |the )?(order|package|delivery)\b.{0,25}\b(arrive|ship|get here|come|deliver)\b/i,
    ],
  },
  {
    category: 'business_address',
    patterns: [
      /\b(mailing|postal|physical|business|company|return|street) address\b/i,
      /\bwhere (are|is) (you|your (company|business|office|warehouse))\b.{0,20}\b(located|based|headquartered|ship(ped)? from)\b/i,
      /\byour (headquarters|hq|office|address)\b/i,
      /\bwhat('?s| is) your address\b/i,
    ],
  },
  {
    category: 'refund_window',
    patterns: [
      /\b(return|refund)s? (policy|window|period|timeframe)\b/i,
      /\bhow (long|many days)\b.{0,30}\b(return|refund|send (it )?back)\b/i,
      /\bcan i (still )?(return|send back|get a refund)\b/i,
      /\b(window|deadline) (to|for) (a )?(return|refund)\b/i,
      /\bwhat('?s| is) your (return|refund) policy\b/i,
      /\bdo you (accept|take|do) returns\b/i,
    ],
  },
  {
    category: 'shipping_rates',
    patterns: [
      /\bhow much\b.{0,30}\b(shipping|delivery|postage)\b/i,
      /\b(shipping|delivery|postage)\b.{0,20}\b(cost|costs|rate|rates|price|prices|fee|fees|charge|charges)\b/i,
      /\b(cost|price|rate|fee) (of|for) (shipping|delivery|postage)\b/i,
      /(?<![\w-])free[-\s]shipping\b/i,
      /\bhow (long|many days)\b.{0,30}\b(shipping|delivery|to (ship|deliver|arrive|get here))\b/i,
      /\bhow (fast|quick(ly)?|soon)\b.{0,25}\b(ship|shipped|deliver|delivered|arrive|get here)\b/i,
      /\b(shipping|delivery) (time|times|speed|estimate|estimates|option|options|method|methods)\b/i,
      /\bwhat (are|r) your shipping\b/i,
      /\bdo you (offer|have|do)\b.{0,20}\b(express|overnight|expedited|rush|next[- ]day|2[- ]day|two[- ]day)\b/i,
    ],
    exclude: [
      /\b(return|exchange)s?\b.{0,20}\bship/i,
      /\bship(ping)?\b.{0,20}\b(it |them )?back\b/i,
      /\bshipping address\b/i,
      /\b(do|does|can|could|will|would)\s+(you|they|the store)\b.{0,15}\bship (to|outside|overseas|abroad)\b/i,
      /\b(international(ly)?|overseas|abroad|customs|duties|tariffs?)\b/i,
    ],
  },
];

/** Pure classification. A miss performs no settings, model, or network I/O. */
export function classifyQuery(question: string): DeterministicCategory | null {
  if (typeof question !== 'string') return null;
  const normalized = question.trim();
  if (!normalized) return null;
  const bounded = normalized.slice(0, 2_048);
  for (const rule of RULES) {
    if (rule.exclude?.some((pattern) => pattern.test(bounded))) continue;
    if (rule.patterns.some((pattern) => pattern.test(bounded))) return rule.category;
  }
  return null;
}

/**
 * Resolve a classified answer exclusively from validated canonical facts and
 * current policy settings. `null` means the verified value is unavailable; the
 * caller must use its guarded non-deterministic/fallback path.
 */
export async function resolveDeterministicAnswer(
  category: DeterministicCategory,
  facts: CanonicalFacts,
  deps: DeterministicAnswerDependencies = DEFAULT_DEPENDENCIES,
): Promise<string | null> {
  switch (category) {
    case 'contact_email':
      return contactAnswer(facts);
    case 'order_status':
      return orderStatusAnswer(facts);
    case 'business_address':
      return businessAddressAnswer(facts);
    case 'refund_window':
      return refundWindowAnswer(facts, deps);
    case 'shipping_rates':
      return shippingRatesAnswer(facts, deps);
  }
}

function contactAnswer(facts: CanonicalFacts): string | null {
  if (!facts.supportEmail) return null;
  const hours = facts.supportHours ? ` Support hours are ${facts.supportHours}.` : '';
  return `You can reach ${facts.storeName} support at ${facts.supportEmail}.${hours}`;
}

function orderStatusAnswer(facts: CanonicalFacts): string | null {
  if (facts.orderHistoryUrl) {
    const contact = facts.supportEmail
      ? ` If something looks wrong, contact ${facts.supportEmail}.`
      : '';
    return `View your current order status and tracking at ${facts.orderHistoryUrl}.${contact}`;
  }
  if (facts.supportEmail) {
    return `For help with an order, contact ${facts.supportEmail}.`;
  }
  return null;
}

function businessAddressAnswer(facts: CanonicalFacts): string | null {
  if (!facts.businessAddress) return null;
  return `${facts.storeName}'s business address is ${facts.businessAddress}.`;
}

async function refundWindowAnswer(
  facts: CanonicalFacts,
  deps: DeterministicAnswerDependencies,
): Promise<string | null> {
  try {
    const { returnWindowDays } = await deps.getRefundPolicy();
    if (returnWindowDays === null || !Number.isSafeInteger(returnWindowDays) || returnWindowDays <= 0) {
      return policyFallback(facts);
    }
    const details = facts.returnsUrl ? ` Full details: ${facts.returnsUrl}.` : '';
    const contact = facts.supportEmail ? ` Questions can go to ${facts.supportEmail}.` : '';
    return `The return window is ${returnWindowDays} days from delivery.${details}${contact}`;
  } catch {
    return policyFallback(facts);
  }
}

function policyFallback(facts: CanonicalFacts): string | null {
  if (facts.returnsUrl) {
    const contact = facts.supportEmail ? ` For help, contact ${facts.supportEmail}.` : '';
    return `The current return policy is available at ${facts.returnsUrl}.${contact}`;
  }
  if (facts.supportEmail) return `Contact ${facts.supportEmail} for the current return policy.`;
  return null;
}

async function shippingRatesAnswer(
  facts: CanonicalFacts,
  deps: DeterministicAnswerDependencies,
): Promise<string | null> {
  try {
    const resolved = await deps.resolveShippingOptions(0, {
      currency: facts.currency,
      subtotalPriceable: false,
    });
    if (resolved.options.length === 0) return shippingFallback(facts);

    const rates = resolved.options
      .map((option) => describeShippingOption(option, facts.locale, facts.currency))
      .join('; ');
    const free = freeShippingSentence(
      resolved.options,
      resolved.freeShippingThresholdMajor,
      resolved.freeMethodIds,
      facts.locale,
      facts.currency,
    );
    return `Current shipping options: ${rates}.${free} Checkout confirms availability and the exact cost for your destination and order.`;
  } catch {
    return shippingFallback(facts);
  }
}

function describeShippingOption(
  option: ResolvedShippingOption,
  locale: string,
  currency: string,
): string {
  const price = Money.fromStored(option.cost, currency);
  const formatted = price.isZero() ? 'free' : price.format(locale);
  const timing = /\d/.test(option.label)
    ? ''
    : ` (about ${option.estimatedDays} business ${option.estimatedDays === 1 ? 'day' : 'days'})`;
  return `${option.label}${timing} — ${formatted}`;
}

function freeShippingSentence(
  options: ResolvedShippingOption[],
  thresholdMajor: number,
  freeMethodIds: string[],
  locale: string,
  currency: string,
): string {
  const eligible = options.filter((option) => freeMethodIds.includes(option.id));
  if (eligible.length === 0 || !Number.isFinite(thresholdMajor) || thresholdMajor <= 0) return '';
  const threshold = Money.fromMajor(thresholdMajor, currency).format(locale);
  return ` Orders of ${threshold} or more use free ${formatList(eligible.map((option) => option.label))} shipping.`;
}

function shippingFallback(facts: CanonicalFacts): string | null {
  const contact = facts.supportEmail ? ` For help, contact ${facts.supportEmail}.` : '';
  return `Checkout shows the current shipping options and exact cost for your destination and order.${contact}`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export const DETERMINISTIC_CATEGORIES: readonly DeterministicCategory[] = RULES.map(
  (rule) => rule.category,
);
