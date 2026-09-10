import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Money } from '@/lib/money';
import {
  resolveCommerceCapabilities,
  CommerceCapabilityConfigurationError,
} from '@/lib/commerce/capabilities';
import { HONOR_GUARD_SETTING_KEY, HONOR_GUARD_STALE_SECONDS } from '@/lib/gift-cards/honor-guard';
import { TELEMETRY_EVENTS } from '@/lib/observability/telemetry';

// Source-contract test (13-06): the four-state table in both operator docs is
// checked against the capability code and the honor-guard constants on every
// run, not by a reviewer's memory (T-13-22).

const root = process.cwd();
const runtimeConfigDoc = readFileSync(join(root, 'docs/runtime-configuration.md'), 'utf8');
const deploymentSetupDoc = readFileSync(join(root, 'docs/DEPLOYMENT_SETUP.md'), 'utf8');
const packageScripts = (
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
).scripts;

/**
 * Strip fenced code blocks and HTML comments before any "does the doc mention
 * X" prose search, so a fenced example or a comment cannot satisfy a prose
 * assertion it never actually made in running text.
 */
function stripFencesAndComments(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

/** The four data rows of the sell/honor state table: `| on | on | ... |`. */
function fourStateRows(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => /^\|\s*(on|off)\s*\|\s*(on|off)\s*\|/i.test(line.trim()));
}

function findRow(rows: string[], sell: 'on' | 'off', honor: 'on' | 'off'): string | undefined {
  const pattern = new RegExp(`^\\|\\s*${sell}\\s*\\|\\s*${honor}\\s*\\|`, 'i');
  return rows.find((row) => pattern.test(row.trim()));
}

function giftCardSpies() {
  return {
    resolveTender: vi.fn(async ({ currency }: { currency: string }) => ({
      amount: Money.zero(currency),
    })),
    verifyReservedTender: vi.fn(async () => undefined),
    applyTender: vi.fn(async () => undefined),
    releaseTender: vi.fn(async () => undefined),
    restoreTender: vi.fn(async () => undefined),
  };
}

describe('gift-card flag docs: four-state table shape', () => {
  it('docs/runtime-configuration.md carries exactly four sell/honor state rows', () => {
    const prose = stripFencesAndComments(runtimeConfigDoc);
    expect(fourStateRows(prose)).toHaveLength(4);
  });

  it('docs/DEPLOYMENT_SETUP.md carries exactly four sell/honor state rows', () => {
    const prose = stripFencesAndComments(deploymentSetupDoc);
    expect(fourStateRows(prose)).toHaveLength(4);
  });
});

describe('gift-card flag docs: sell-on/honor-off is a real throw, not just prose', () => {
  it.each([
    ['docs/runtime-configuration.md', runtimeConfigDoc],
    ['docs/DEPLOYMENT_SETUP.md', deploymentSetupDoc],
  ])('%s claims the runtime refuses this state', (_name, doc) => {
    const rows = fourStateRows(stripFencesAndComments(doc));
    const row = findRow(rows, 'on', 'off');
    expect(row).toBeDefined();
    expect(row).toMatch(/throw/i);
  });

  it('resolveCommerceCapabilities actually throws with sell on and honor off', () => {
    // RED evidence (13-06 task 2): intentionally inverted assertion. Real
    // production behavior (`lib/commerce/capabilities.ts`) throws in this
    // state; asserting `.not.toThrow()` here must fail for real, proving the
    // check can tell true doc claims from false ones before GREEN restores it.
    expect(() => resolveCommerceCapabilities({
      giftCardAcquisition: true,
      giftCardReconciliation: false,
      subscriptionAcquisition: false,
      subscriptionReconciliation: false,
    })).not.toThrow(CommerceCapabilityConfigurationError);
  });
});

describe('gift-card flag docs: sell-off/honor-on still honors, not just prose', () => {
  it.each([
    ['docs/runtime-configuration.md', runtimeConfigDoc],
    ['docs/DEPLOYMENT_SETUP.md', deploymentSetupDoc],
  ])('%s claims honoring keeps working in this state', (_name, doc) => {
    const rows = fourStateRows(stripFencesAndComments(doc));
    const row = findRow(rows, 'off', 'on');
    expect(row).toBeDefined();
    expect(row).toMatch(/honoring/i);
  });

  it('resolveCommerceCapabilities delegates a nonempty-token tender with sell off and honor on', async () => {
    const capability = giftCardSpies();
    const factory = vi.fn(() => capability);
    const resolved = resolveCommerceCapabilities({
      giftCardAcquisition: false,
      giftCardReconciliation: true,
      subscriptionAcquisition: false,
      subscriptionReconciliation: false,
    }, { giftCards: factory });

    expect(factory).toHaveBeenCalledOnce();
    await resolved.giftCards.resolveTender({
      token: 'GC-DOC-CONTRACT',
      currency: 'USD',
      amountDue: Money.fromMinor(500, 'USD'),
    });
    // RED evidence (13-06 task 2): intentionally inverted assertion. Real
    // production behavior delegates the nonempty token; asserting
    // `.not.toHaveBeenCalledWith(...)` here must fail for real.
    expect(capability.resolveTender).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: 'GC-DOC-CONTRACT' }),
    );
  });
});

describe('gift-card flag docs: honor-guard constants are imported, not copied', () => {
  it('both docs name the honor-guard settings key exactly as HONOR_GUARD_SETTING_KEY', () => {
    expect(runtimeConfigDoc).toContain(HONOR_GUARD_SETTING_KEY);
    expect(deploymentSetupDoc).toContain(HONOR_GUARD_SETTING_KEY);
  });

  it('any staleness figure quoted in minutes matches HONOR_GUARD_STALE_SECONDS', () => {
    const expectedMinutes = HONOR_GUARD_STALE_SECONDS / 60;
    const combined = `${runtimeConfigDoc}\n${deploymentSetupDoc}`;
    const match = combined.match(/older than (\d+)\s*minutes/i);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(expectedMinutes);
  });

  it('the telemetry event named in the docs is registered critical', () => {
    const match = runtimeConfigDoc.match(/`(gift_card\.[a-z_]+)`/);
    expect(match).not.toBeNull();
    const eventName = match?.[1] as keyof typeof TELEMETRY_EVENTS;
    expect(TELEMETRY_EVENTS).toHaveProperty(eventName);
    expect(TELEMETRY_EVENTS[eventName].severity).toBe('critical');
    expect(deploymentSetupDoc).toContain(eventName);
  });
});

describe('gift-card flag docs: no dangling npm run reference', () => {
  it('every "npm run <name>" in either doc resolves to a real package.json script', () => {
    const pattern = /npm run ([a-zA-Z0-9_:-]+)/g;
    const names: string[] = [];
    for (const doc of [runtimeConfigDoc, deploymentSetupDoc]) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(doc)) !== null) {
        names.push(match[1]);
      }
    }
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(packageScripts).toHaveProperty(name);
    }
  });
});
