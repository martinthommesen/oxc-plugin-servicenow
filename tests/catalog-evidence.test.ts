import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ruleCatalog } from "../src/catalog.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "../src/settings/releases.js";
import { repoRoot } from "./integration/helpers.js";

// @lat: [[tests#The catalog#Every evidence record resolves]]
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
        const contents = readFileSync(source, "utf8");
        assert.ok(contents.trim().length > 0, evidence.url);
        // A unit-test fixture must actually exercise the rule it is cited
        // for. Naming a test file that never mentions the rule makes the
        // evidence record unfalsifiable.
        if (evidence.verifiedBy === "fixture" && evidence.url.startsWith("tests/rules/")) {
          assert.ok(contents.includes(entry.name), `${evidence.url} never exercises ${entry.name}`);
        }
        assert.ok(
          entry.bad.length + entry.good.length > 0,
          `${entry.name} needs executable examples`,
        );
      });
    }
  }
});
