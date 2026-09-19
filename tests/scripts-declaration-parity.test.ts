import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

function declarationFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...declarationFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".d.mts")) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

// @lat: [[tests#Scripts and tooling#Script declarations match their implementations]]
describe("script declaration parity (FINDINGS.md MNT-005)", () => {
  const declarations = declarationFiles(scriptsDir);
  assert.ok(declarations.length > 0);
  assert.ok(declarations.some((file) => file.endsWith(path.join("lib", "test-report.d.mts"))));
  for (const declarationPath of declarations) {
    const implementationPath = declarationPath.replace(/\.d\.mts$/, ".mjs");
    const declaration = path.relative(scriptsDir, declarationPath);
    const implementation = path.relative(scriptsDir, implementationPath);
    it(`${implementation} matches ${declaration}`, () => {
      assert.ok(existsSync(implementationPath), `${declaration} has no implementation`);
      const declared = valueExports(readFileSync(declarationPath, "utf8"));
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
