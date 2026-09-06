/**
 * Computes the next roving-tabindex index for an arrow-key press inside one
 * segmented group or grid, wrapping at both ends. Shared by ThemePresetGrid
 * and LayoutSwitches (07-REVIEW WR-02) so both admin islands' keyboard math
 * can never silently drift apart — previously LayoutSwitches carried its own
 * verbatim copy of this function with no parity test guarding the two.
 */
export function nextRovingIndex(currentIndex: number, key: string, length: number): number {
  const delta = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  return (currentIndex + delta + length) % length;
}
