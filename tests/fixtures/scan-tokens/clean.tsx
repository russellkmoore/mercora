/**
 * Example usage: cn("bg-red-500", "text-white") for reference only — this is
 * documentation, not live code, and must not register as a finding.
 */
// bg-orange-500 in a line comment, ignored
/* border-neutral-700 inside a block comment, ignored */
export function Clean() {
  return (
    <div className="bg-surface text-foreground border-border rounded-md">
      Clean
    </div>
  );
}
