import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  escapeHtmlText,
  safeMaintenanceMessage,
} from '@/lib/utils/maintenance-html';

describe('maintenance HTML text safety', () => {
  it('escapes every HTML-significant text character', () => {
    expect(escapeHtmlText(`<script a="b">Tom & 'friends'</script>`)).toBe(
      '&lt;script a=&quot;b&quot;&gt;Tom &amp; &#x27;friends&#x27;&lt;/script&gt;'
    );
  });

  it('escapes a configured maintenance message', () => {
    expect(safeMaintenanceMessage('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  it.each([undefined, null, false, 0, {}, [], '', '   '])(
    'uses the escaped default for non-message value %j',
    (value) => {
      expect(safeMaintenanceMessage(value)).toBe(escapeHtmlText(DEFAULT_MAINTENANCE_MESSAGE));
    }
  );
});
