import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const instrumentation = {
  'app/api/payment-intent/route.ts': [
    'payment.pricing_rejected',
    'payment.inventory_unavailable',
    'payment.intent_create_failed',
    'payment.order_persist_failed',
  ],
  'app/api/orders/route.ts': [
    'order.payment_verification_rejected',
    'order.finalization_failed',
  ],
  'app/api/webhooks/stripe/route.ts': [
    'webhook.signature_rejected',
    'webhook.claim_failed',
    'webhook.processing_failed',
    'webhook.failure_record_failed',
  ],
  'app/api/orders/refund/route.ts': [
    'refund.request_rejected',
    'refund.provider_unresolved',
    'refund.provider_inconsistent',
    'refund.settlement_failed',
  ],
  'lib/services/order-effects.ts': [
    'paid_effect.repeated_failure',
    'paid_effect.first_attempt_failed',
  ],
  'lib/services/inventory-adjustments.ts': [
    'inventory.adjustment_repeated_failure',
    'inventory.adjustment_needs_review',
  ],
  'lib/fulfillment/shipping-email.ts': [
    'email.delivery_failed',
    'email.audit_write_failed',
  ],
  'app/api/admin/orders/[id]/events/route.ts': ['fulfillment.query_failed'],
  'lib/recommendations/cron.ts': ['recommendation.rebuild_failed'],
  'worker.ts': ['cron.recovery_failed'],
} as const;

function parseSource(path: string): ts.SourceFile {
  const source = readFileSync(join(process.cwd(), path), 'utf8');
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function telemetryCalls(source: ts.SourceFile): Set<string> {
  const events = new Set<string>();
  const collectEventLiterals = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) events.add(node.text);
    else ts.forEachChild(node, collectEventLiterals);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      node.expression.text === 'recordTelemetry' &&
      node.arguments[0]) {
      collectEventLiterals(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return events;
}

function rawExceptionConsoleCalls(source: ts.SourceFile): string[] {
  const calls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'console' &&
      (node.expression.name.text === 'error' || node.expression.name.text === 'warn') &&
      node.arguments.some((argument) => ts.isIdentifier(argument) && argument.text === 'error')) {
      calls.push(node.expression.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}

describe('actionable failure telemetry wiring', () => {
  it('covers current commerce and operational paths with the closed taxonomy', () => {
    for (const [path, events] of Object.entries(instrumentation)) {
      const calls = telemetryCalls(parseSource(path));
      for (const event of events) expect(calls, `${path}: ${event}`).toContain(event);
    }
  });

  it('does not retain raw exception console logging in instrumented boundaries', () => {
    for (const path of Object.keys(instrumentation)) {
      expect(rawExceptionConsoleCalls(parseSource(path)), path).toEqual([]);
    }
  });
});
