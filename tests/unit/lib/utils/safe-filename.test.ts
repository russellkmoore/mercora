import { describe, expect, it } from 'vitest';
import {
  MAX_SAFE_FILENAME_LENGTH,
  isSafeFilenameSegment,
  isSafeKnowledgeFilename,
  normalizeKnowledgeFilename,
  normalizeSafeFilenameSegment,
} from '@/lib/utils/safe-filename';

describe('safe filename segments', () => {
  it('normalizes surrounding whitespace and accepts ordinary names', () => {
    expect(normalizeSafeFilenameSegment('  guide.md  ')).toBe('guide.md');
    expect(isSafeFilenameSegment('product-primary')).toBe(true);
    expect(isSafeKnowledgeFilename('returns.md')).toBe(true);
  });

  it.each([
    '../escape.md',
    'nested/file.md',
    'nested\\file.md',
    'embedded..dots.md',
    '.',
    '..',
    '',
    '   ',
    'line\nbreak.md',
    'nul\0byte.md',
  ])('rejects unsafe segment %j', (value) => {
    expect(normalizeSafeFilenameSegment(value)).toBeNull();
  });

  it('rejects non-strings and overlong segments', () => {
    expect(normalizeSafeFilenameSegment(undefined)).toBeNull();
    expect(normalizeSafeFilenameSegment(123)).toBeNull();
    expect(normalizeSafeFilenameSegment('a'.repeat(MAX_SAFE_FILENAME_LENGTH + 1))).toBeNull();
    expect(normalizeSafeFilenameSegment('a'.repeat(MAX_SAFE_FILENAME_LENGTH))).toHaveLength(
      MAX_SAFE_FILENAME_LENGTH
    );
  });

  it('appends .md before enforcing the final knowledge filename bound', () => {
    expect(normalizeKnowledgeFilename('a'.repeat(252), true)).toBe(
      `${'a'.repeat(252)}.md`
    );
    expect(normalizeKnowledgeFilename('a'.repeat(253), true)).toBeNull();
  });

  it('requires existing knowledge delete/status names to end in lowercase .md', () => {
    expect(normalizeKnowledgeFilename('guide.md')).toBe('guide.md');
    expect(normalizeKnowledgeFilename('guide')).toBeNull();
    expect(normalizeKnowledgeFilename('guide.MD')).toBeNull();
  });
});
