import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ruleCatalog } from "../src/catalog.js";
import {
  AUSTRALIA_ENGINE_UPDATES,
  AUSTRALIA_ENGINE_UPDATE_EVIDENCE,
  ENGINE_FEATURES,
} from "../src/engine/index.js";

const OFFICIAL_ROWS = [
  "rhino-2048-error-iserror:2048",
  "rhino-2029-set-methods:2029",
  "rhino-2025-promise-try:2025",
  "rhino-1966-typed-array-factories:1966",
  "rhino-1980-promise-withresolvers:1980",
  "rhino-1905-arraybuffer-detachment:1905",
  "rhino-1896-date-fraction-digits:1896",
  "rhino-1751-1872-symbol-hasinstance:1751,1872",
  "rhino-1870-string-regexp-methods:1870",
  "rhino-2073-2107-duplicate-object-keys:2073,2107",
  "rhino-2097-eval-function-result:2097",
  "rhino-2065-template-literal-conversion:2065",
  "rhino-2060-compiled-strict-mode:2060",
  "rhino-1979-bigint-narrowing:1979",
  "rhino-1860-function-call-apply-thisarg:1860",
  "rhino-1982-array-from-thisarg:1982",
  "rhino-1945-require-this:1945",
  "rhino-1774-method-constructors:1774",
  "rhino-1806-block-function-hoisting:1806",
];

describe("Australia JavaScript engine update ledger", () => {
  it("pins every row in the reviewed official update table", () => {
    assert.deepEqual(
      AUSTRALIA_ENGINE_UPDATES.map((update) => `${update.id}:${update.pullRequests.join(",")}`),
      OFFICIAL_ROWS,
    );
    assert.equal(new Set(AUSTRALIA_ENGINE_UPDATES.map((update) => update.id)).size, 19);
    const pullRequests = AUSTRALIA_ENGINE_UPDATES.flatMap((update) => update.pullRequests);
    assert.equal(new Set(pullRequests).size, pullRequests.length);
    assert.deepEqual(AUSTRALIA_ENGINE_UPDATE_EVIDENCE, {
      url: "https://www.servicenow.com/docs/r/api-reference/scripts/updates-javascript-engine.html",
      officialReleaseLabel: "Australia",
      officialUpdatedAt: "2026-03-12",
      reviewedAt: "2026-08-24",
    });
  });

  it("keeps pending work explicit and completed coverage connected", () => {
    const catalogRules = new Set(ruleCatalog.map((entry) => entry.name));
    const linkedFeatures = new Set<string>();
    const counts = { diagnostic: 0, "metadata-only": 0, pending: 0 };

    for (const update of AUSTRALIA_ENGINE_UPDATES) {
      counts[update.disposition.kind] += 1;
      assert.ok(update.description.length > 0, update.id);
      assert.ok(update.disposition.rationale.length > 0, update.id);
      if (update.disposition.kind === "pending") continue;
      assert.ok(update.disposition.featureIds.length > 0, update.id);
      for (const featureId of update.disposition.featureIds) {
        assert.ok(ENGINE_FEATURES[featureId], `${update.id}: ${featureId}`);
        linkedFeatures.add(featureId);
        for (const cell of Object.values(ENGINE_FEATURES[featureId].releases)) {
          assert.equal(cell.evidence, AUSTRALIA_ENGINE_UPDATE_EVIDENCE.url, update.id);
          if (update.mode === "all") {
            assert.deepEqual(cell.supportBasis, {
              compatibility: "official-release-update",
              es5: "official-release-update",
              es2021: "official-release-update",
            });
          } else {
            assert.equal(cell.supportBasis[update.mode], "official-release-update", update.id);
          }
        }
      }
      if (update.disposition.kind === "diagnostic") {
        assert.ok(update.disposition.ruleIds.length > 0, update.id);
        for (const ruleId of update.disposition.ruleIds) {
          assert.ok(catalogRules.has(ruleId), `${update.id}: ${ruleId}`);
        }
      }
    }

    assert.deepEqual(counts, { diagnostic: 10, "metadata-only": 1, pending: 8 });
    const updateFeatures = Object.values(ENGINE_FEATURES)
      .filter((feature) =>
        Object.values(feature.releases).every(
          (cell) => cell.evidence === AUSTRALIA_ENGINE_UPDATE_EVIDENCE.url,
        ),
      )
      .map((feature) => feature.id)
      .sort();
    assert.deepEqual([...linkedFeatures].sort(), updateFeatures);
  });
});
