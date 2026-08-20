import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context } from "@oxlint/plugins";
import {
  getValidatedSettings,
  getValidatedSettingsResult,
  validateServiceNowSettings,
} from "../src/settings/index.js";

function context(filename: string, servicenow?: unknown): Context {
  return {
    filename,
    settings: servicenow === undefined ? {} : { servicenow },
    options: [],
  } as unknown as Context;
}

describe("validated settings immutability", () => {
  it("deep-freezes the shared empty default", () => {
    const first = validateServiceNowSettings(undefined);
    const second = validateServiceNowSettings(undefined);
    assert.equal(first, second);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.settings));
    assert.ok(Object.isFrozen(first.settings.allowedSysIds));
    assert.ok(Object.isFrozen(first.settings.allowedTables));
    assert.ok(Object.isFrozen(first.deprecations));
    assert.throws(() => {
      (first.settings.allowedSysIds as string[]).push("00".repeat(16));
    }, TypeError);
    assert.throws(() => {
      (first.settings as { scope: string }).scope = "global";
    }, TypeError);
    assert.equal(first.settings.allowedSysIds.length, 0);
    assert.equal(second.settings.allowedSysIds.length, 0);
  });

  it("deep-freezes validated custom settings", () => {
    const result = validateServiceNowSettings({
      allowedSysIds: ["97c04b3b1b12100043ab85e5bd0713e2"],
      allowedTables: ["incident"],
    });
    assert.ok(Object.isFrozen(result.settings));
    assert.ok(Object.isFrozen(result.settings.allowedSysIds));
    assert.throws(() => {
      (result.settings.allowedSysIds as string[]).push("aa".repeat(16));
    }, TypeError);
    assert.deepEqual(result.settings.allowedSysIds, ["97c04b3b1b12100043ab85e5bd0713e2"]);
  });

  it("does not let one context mutate the shared default used by another", () => {
    const a = getValidatedSettings(context("one.br.js"));
    const b = getValidatedSettings(context("two.br.js"));
    assert.equal(a, b);
    assert.throws(() => {
      (a.allowedTables as string[]).push("incident");
    }, TypeError);
    assert.equal(b.allowedTables.length, 0);
    const again = getValidatedSettingsResult(context("three.br.js"));
    assert.equal(again.settings.allowedTables.length, 0);
  });
});
