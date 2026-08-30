import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.join(import.meta.dirname, "..");
const scriptsDir = path.join(root, "scripts");

// The hand-written .d.mts files are asserted, never verified: the
// type-checker validates callers against the declarations and nothing
// validates the declarations against the code, so an added or renamed
// export drifts silently (FINDINGS.md MNT-005). This pins the export
// lists in both directions; signatures remain unchecked until a
// checked-JavaScript project is viable (176 errors on first run).
function valueExports(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(match[1]!);
  }
  for (const match of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const raw of match[1]!.split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && !name.startsWith("type ")) names.add(name);
    }
  }
  // Direct default exports carry no binding name; record them as "default"
  // in both file forms so a default export missing from either side of a
  // pair still fails the parity comparison.
  if (/^export\s+default\b/m.test(source)) names.add("default");
  return names;
}

describe("script declaration parity (FINDINGS.md MNT-005)", () => {
  const declarations = readdirSync(scriptsDir).filter((entry) => entry.endsWith(".d.mts"));
  assert.ok(declarations.length > 0);
  for (const declaration of declarations) {
    const implementation = declaration.replace(/\.d\.mts$/, ".mjs");
    it(`${implementation} matches ${declaration}`, () => {
      const implementationPath = path.join(scriptsDir, implementation);
      assert.ok(existsSync(implementationPath), `${declaration} has no implementation`);
      const declared = valueExports(readFileSync(path.join(scriptsDir, declaration), "utf8"));
      const implemented = valueExports(readFileSync(implementationPath, "utf8"));
      const undeclared = [...implemented].filter((name) => !declared.has(name));
      const stale = [...declared].filter((name) => !implemented.has(name));
      assert.deepEqual(
        { undeclared, stale },
        { undeclared: [], stale: [] },
        `${implementation}: undeclared exports ${JSON.stringify(undeclared)}, stale declarations ${JSON.stringify(stale)}`,
      );
    });
  }
});
