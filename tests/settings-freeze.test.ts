import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context } from "@oxlint/plugins";
import {
  getValidatedSettings,
  getValidatedSettingsResult,
  validateServiceNowSettings,
} from "../src/settings/index.js";
import { deriveSettingsDescriptorProducts } from "../src/settings/validate.js";
import { deepFreeze } from "../src/settings/freeze.js";

function context(filename: string, servicenow?: unknown): Context {
  return {
    filename,
    settings: servicenow === undefined ? {} : { servicenow },
    options: [],
  } as unknown as Context;
}

describe("validated settings immutability", () => {
  it("freezes cyclic objects without recursive failure", () => {
    const value: { self?: unknown } = {};
    value.self = value;
    assert.equal(deepFreeze(value), value);
    assert.equal(Object.isFrozen(value), true);
  });

  it("derives keys, defaults, parsing, freezing, and fingerprints from one descriptor", () => {
    const products = deriveSettingsDescriptorProducts({
      synthetic: {
        defaultValue: () => 1,
        parse(path, value) {
          assert.equal(path, ".synthetic");
          assert.equal(typeof value, "number");
          return value as number;
        },
      },
    });
    assert.equal(products.keys.has("synthetic"), true);
    assert.deepEqual(products.defaults(), { synthetic: 1 });
    const parsed = products.validate({ synthetic: 2 });
    assert.deepEqual(parsed, { synthetic: 2 });
    assert.equal(Object.isFrozen(parsed), true);
    assert.notEqual(products.fingerprint(parsed), products.fingerprint(products.validate({})));
  });

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

  it("invalidates cached settings after scalar and array mutation", () => {
    const raw: { javascriptMode: "es5" | "es2021"; surfaces: Array<"client" | "server"> } = {
      javascriptMode: "es5",
      surfaces: ["client"],
    };
    const first = getValidatedSettingsResult(context("same.js", raw));
    assert.equal(getValidatedSettingsResult(context("same.js", raw)), first);
    raw.javascriptMode = "es2021";
    const second = getValidatedSettingsResult(context("same.js", raw));
    assert.notEqual(second, first);
    assert.equal(second.settings.javascriptMode, "es2021");
    raw.surfaces[0] = "server";
    const third = getValidatedSettingsResult(context("same.js", raw));
    assert.notEqual(third, second);
    assert.deepEqual(third.settings.surfaces, ["server"]);
  });
});
