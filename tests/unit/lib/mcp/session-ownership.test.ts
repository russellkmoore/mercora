import { beforeEach, describe, expect, it, vi } from 'vitest';

const selectLimit = vi.fn();
const deleteWhere = vi.fn();

vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
    delete: () => ({ where: deleteWhere }),
  })),
}));

import { requireOwnedSession } from '@/lib/mcp/session';

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    agentId: 'agent-a',
    userId: null,
    userPreferences: null,
    sessionContext: null,
    cart: '[]',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  selectLimit.mockReset();
  deleteWhere.mockReset().mockResolvedValue(undefined);
});

describe('requireOwnedSession', () => {
  it('returns not found for a missing session', async () => {
    selectLimit.mockResolvedValue([]);
    await expect(requireOwnedSession('missing', 'agent-a')).resolves.toEqual({
      ok: false,
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found or expired',
    });
  });

  it('deletes and hides an expired session', async () => {
    selectLimit.mockResolvedValue([sessionRow({ expiresAt: new Date(Date.now() - 1).toISOString() })]);
    const result = await requireOwnedSession('session-1', 'agent-a');
    expect(result).toMatchObject({ ok: false, code: 'SESSION_NOT_FOUND' });
    expect(deleteWhere).toHaveBeenCalledOnce();
  });

  it('denies a different authenticated agent', async () => {
    selectLimit.mockResolvedValue([sessionRow({ agentId: 'victim' })]);
    await expect(requireOwnedSession('session-1', 'attacker')).resolves.toEqual({
      ok: false,
      code: 'SESSION_ACCESS_DENIED',
      message: 'Agent does not own this session',
    });
  });

  it('returns an owned active session', async () => {
    selectLimit.mockResolvedValue([sessionRow()]);
    const result = await requireOwnedSession('session-1', 'agent-a');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.agentId).toBe('agent-a');
  });
});
