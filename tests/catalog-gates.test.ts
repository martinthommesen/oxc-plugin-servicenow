import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ruleCatalog } from "../src/catalog.js";
import { CLASSIC_SURFACES, CLIENT_SURFACES, SERVER_SURFACES } from "../src/surfaces.js";
import {
  assertRuleGateAgreement,
  delegateFileFor,
  implementationFileFor,
} from "../scripts/lib/catalog-gates.mjs";
import { repoRoot } from "./integration/helpers.js";

const surfaces = {
  server: SERVER_SURFACES,
  client: CLIENT_SURFACES,
  classic: CLASSIC_SURFACES,
};

function ruleInput(name: string) {
  const rule = ruleCatalog.find((entry) => entry.name === name);
  assert.ok(rule, `catalog is missing ${name}`);
  const catalogSource = readFileSync(path.join(repoRoot, "src/catalog", `${name}.ts`), "utf8");
  const implName = implementationFileFor(name, catalogSource);
  const ruleSource = readFileSync(path.join(repoRoot, "src/rules", `${implName}.ts`), "utf8");
  const delegate = delegateFileFor(ruleSource);
  const delegateSource = delegate
    ? readFileSync(path.join(repoRoot, "src/rules", `${delegate}.ts`), "utf8")
    : undefined;
  return {
    ruleName: name,
    implName,
    applicability: rule.applicability,
    ruleSource,
    delegateSource,
    surfaces,
  };
}

// @lat: [[tests#The catalog#Declared applicability implies an implemented gate]]
describe("catalog gate agreement (FINDINGS.md COR-015)", () => {
  it("holds for every catalog rule", () => {
    assert.ok(ruleCatalog.length > 0);
    for (const rule of ruleCatalog) {
      assertRuleGateAgreement(ruleInput(rule.name));
    }
  });

  it("fails when a server-surface gate is removed", () => {
    const input = ruleInput("require-query-before-next");
    assert.match(input.ruleSource, /\bisServerInstanceContext\s*\(/);
    const stripped = input.ruleSource.replaceAll("isServerInstanceContext", "isInstanceScript");
    assert.throws(
      () => assertRuleGateAgreement({ ...input, ruleSource: stripped }),
      /must call isServerInstanceContext/,
    );
  });

  it("fails when an engine feature gate is removed", () => {
    const input = ruleInput("no-promise");
    assert.match(input.ruleSource, /\bshouldDiagnoseFeature\s*\(/);
    const stripped = input.ruleSource.replaceAll("shouldDiagnoseFeature", "isFeatureAllowed");
    assert.throws(
      () => assertRuleGateAgreement({ ...input, ruleSource: stripped }),
      /must call shouldDiagnoseFeature/,
    );
  });

  it("fails when a single-surface gate names the wrong surface", () => {
    const input = ruleInput("no-gliderecord-query-in-acl");
    assert.match(input.ruleSource, /appliesOnSurface\(script, "acl"/);
    const swapped = input.ruleSource.replace(
      'appliesOnSurface(script, "acl"',
      'appliesOnSurface(script, "server"',
    );
    assert.throws(
      () => assertRuleGateAgreement({ ...input, ruleSource: swapped }),
      /must call appliesOnSurface with "acl"/,
    );
  });

  it("fails closed on an unrecognized applicability shape", () => {
    const input = ruleInput("require-query-before-next");
    assert.throws(
      () =>
        assertRuleGateAgreement({
          ...input,
          applicability: { ...input.applicability, authoring: "both" },
        }),
      /unrecognized applicability shape/,
    );
  });

  it("resolves factory-delegated gates but fails without the delegate", () => {
    const input = ruleInput("no-map-set");
    assert.doesNotThrow(() => assertRuleGateAgreement(input));
    assert.throws(
      () => assertRuleGateAgreement({ ...input, delegateSource: undefined }),
      /calls no recognized gate helper/,
    );
  });
});
