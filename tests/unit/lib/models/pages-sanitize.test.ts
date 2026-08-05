import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
  getDbAsync: vi.fn(),
  getStoreConfig: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getDbAsync: mocks.getDbAsync }));
vi.mock('@/lib/store-config', () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock('@/lib/utils/sanitize-html-server', async () => {
  const core = await import('@/lib/utils/sanitize-html-core');
  return {
    sanitizePageHtmlServer: core.sanitizePageHtmlServer,
    sanitizeRichHtmlServer: core.sanitizeRichHtmlServer,
  };
});

import { createPage, updatePage } from '@/lib/models/pages';

const currentPage = {
  id: 7,
  title: 'Existing',
  slug: 'existing',
  content: '<p>Existing</p>',
  version: 2,
  status: 'draft',
  template: 'default',
  created_at: 1,
  updated_at: 1,
};

describe('page write sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbAsync.mockResolvedValue(mocks.db);
    mocks.getStoreConfig.mockReturnValue({
      urls: { imageCdn: 'https://cdn.example.test/assets' },
    });
  });

  it('rejects create content that is blank after sanitization before inserting', async () => {
    await expect(createPage({
      title: 'Unsafe',
      slug: 'unsafe',
      content: '<script>alert(1)</script>',
      status: 'draft',
    } as any)).rejects.toThrow('Content is required after sanitization');

    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('persists sanitized create content in both the page and initial history version', async () => {
    const pageValues = vi.fn();
    const versionValues = vi.fn();
    pageValues.mockImplementation((data) => ({
      returning: vi.fn().mockResolvedValue([{ id: 7, ...data }]),
    }));
    versionValues.mockImplementation((data) => ({
      returning: vi.fn().mockResolvedValue([{ id: 1, ...data }]),
    }));
    mocks.db.insert
      .mockReturnValueOnce({ values: pageValues })
      .mockReturnValueOnce({ values: versionValues });

    await createPage({
      title: 'Safe',
      slug: 'safe',
      content: '<p onclick="alert(1)">Hello</p><img src="https://cdn.example.test/assets/a.png">',
      status: 'draft',
    } as any);

    const storedPage = pageValues.mock.calls[0][0];
    const storedVersion = versionValues.mock.calls[0][0];
    expect(storedPage.content).toBe(
      '<p>Hello</p><img src="https://cdn.example.test/assets/a.png" />'
    );
    expect(storedVersion.content).toBe(storedPage.content);
  });

  it('rejects update content that is blank after sanitization before updating', async () => {
    const limit = vi.fn().mockResolvedValue([currentPage]);
    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit }),
      }),
    });

    await expect(updatePage(7, {
      content: '<svg onload="alert(1)"></svg>',
    } as any)).rejects.toThrow('Content is required after sanitization');

    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it('uses sanitized update content for the page, version increment, and history', async () => {
    const limit = vi.fn().mockResolvedValue([currentPage]);
    const updateSet = vi.fn().mockImplementation((data) => ({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...currentPage, ...data }]),
      }),
    }));
    const versionValues = vi.fn().mockImplementation((data) => ({
      returning: vi.fn().mockResolvedValue([{ id: 3, ...data }]),
    }));
    mocks.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit }),
      }),
    });
    mocks.db.update.mockReturnValue({ set: updateSet });
    mocks.db.insert.mockReturnValue({ values: versionValues });

    const updated = await updatePage(7, {
      content: '<p onclick="alert(1)">Updated</p>' +
        '<img src="https://cdn.example.test/assets/a.png" onerror="alert(2)">',
    } as any, 'admin-1', 'Sanitized update');

    const storedUpdate = updateSet.mock.calls[0][0];
    const storedVersion = versionValues.mock.calls[0][0];
    expect(storedUpdate.content).toBe(
      '<p>Updated</p><img src="https://cdn.example.test/assets/a.png" />'
    );
    expect(storedUpdate.version).toBe(3);
    expect(updated?.version).toBe(3);
    expect(storedVersion).toMatchObject({
      page_id: 7,
      content: storedUpdate.content,
      version: 3,
      change_summary: 'Sanitized update',
      created_by: 'admin-1',
    });
  });
});
