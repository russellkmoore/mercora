import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function appSources(directory = join(process.cwd(), "app")): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return appSources(path);
    return /\.(?:ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("main landmark ownership", () => {
  it("keeps the normal app main only in the root layout", () => {
    const matches = appSources()
      .filter((path) => !path.endsWith("global-error.tsx"))
      .flatMap((path) =>
        [...readFileSync(path, "utf8").matchAll(/<main\b/g)].map(() =>
          relative(process.cwd(), path),
        ),
      );

    expect(matches).toEqual(["app/layout.tsx"]);
  });

  it("gives the standalone global fallback exactly one main", () => {
    const source = readFileSync(join(process.cwd(), "app/global-error.tsx"), "utf8");
    expect(source.match(/<main\b/g)).toHaveLength(1);
  });
});
