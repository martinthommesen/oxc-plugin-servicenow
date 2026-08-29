import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ruleCatalog } from "../src/catalog.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "../src/settings/releases.js";
import { lint } from "./helpers/rule-tester.js";
import { repoRoot } from "./integration/helpers.js";

describe("catalog evidence", () => {
  const ids = new Set<string>();
  for (const entry of ruleCatalog) {
    for (const evidence of entry.evidence) {
      assert.equal(ids.has(evidence.verificationId), false, evidence.verificationId);
      ids.add(evidence.verificationId);
      if (evidence.verifiedBy === "manual") {
        // A release-pinned documentation URL must cite a supported release,
        // so evidence does not silently point at a superseded documentation
        // set after a release narrowing (FINDINGS.md DOC-002). The /r/ slot
        // also carries product areas, so only known release names count.
        const RELEASE_NAMES = [
          "australia",
          "tokyo",
          "utah",
          "vancouver",
          "washingtondc",
          "xanadu",
          "yokohama",
          "zurich",
        ];
        const segment = /\/docs\/r\/([a-z0-9-]+)\//.exec(evidence.url)?.[1];
        if (segment && RELEASE_NAMES.includes(segment)) {
          assert.ok(
            (SUPPORTED_SERVICENOW_RELEASES as readonly string[]).includes(segment),
            `${evidence.verificationId} cites unsupported release "${segment}": ${evidence.url}`,
          );
        }
        continue;
      }

      it(`${entry.name}: ${evidence.verificationId}`, () => {
        assert.equal(evidence.url.startsWith("http"), false);
        const source = path.join(repoRoot, evidence.url);
        assert.equal(existsSync(source), true, evidence.url);
        assert.ok(readFileSync(source, "utf8").trim().length > 0, evidence.url);
        assert.ok(
          entry.bad.length + entry.good.length > 0,
          `${entry.name} needs executable examples`,
        );
        for (const example of entry.bad) {
          const messages = lint(example.code, entry.name, {
            filename: example.filename ?? "test.js",
            settings: example.settings,
          });
          assert.ok(messages.length > 0, `${entry.name} should report for ${example.name}`);
        }
        for (const example of entry.good) {
          const messages = lint(example.code, entry.name, {
            filename: example.filename ?? "test.js",
            settings: example.settings,
          });
          assert.equal(messages.length, 0, `${entry.name} should allow ${example.name}`);
        }
      });
    }
  }
});
