import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context } from "@oxlint/plugins";
import {
  getValidatedSettings,
  getValidatedSettingsResult,
  validateServiceNowSettings,
} from "../src/settings/index.js";
import {
  deriveSettingsDescriptorProducts,
  structuralFingerprint,
} from "../src/settings/validate.js";
import { deepFreeze } from "../src/settings/freeze.js";

function context(filename: string, servicenow?: unknown): Context {
  return {
    filename,
    settings: servicenow === undefined ? {} : { servicenow },
    options: [],
  } as unknown as Context;
}

// @lat: [[tests#State and settings#Validated settings are deeply frozen]]
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

  // @lat: [[tests#State and settings#Settings cache identity preserves structural boundaries]]
  it("revalidates delimiter and type-tag mutations instead of reusing valid settings", () => {
    const raw = { surfaces: ["server", "client"] };
    getValidatedSettingsResult(context("same.js", raw));
    raw.surfaces = ["server,string:client"];
    assert.throws(() => validateServiceNowSettings(raw), /surfaces/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /surfaces/);
  });

  // @lat: [[tests#State and settings#Inherited settings remain equivalent to fresh validation]]
  it("invalidates cached inherited settings after scalar and nested array mutation", () => {
    const inherited = { scope: "global", surfaces: ["server", "client"] };
    const raw: object = Object.create(inherited);
    const first = getValidatedSettingsResult(context("same.js", raw));
    assert.equal(first.settings.scope, "global");
    assert.deepEqual(first.settings.surfaces, ["server", "client"]);
    inherited.scope = "scoped";
    const second = getValidatedSettingsResult(context("same.js", raw));
    assert.notEqual(second, first);
    assert.equal(second.settings.scope, "scoped");
    inherited.surfaces[0] = "server,string:client";
    assert.throws(() => validateServiceNowSettings(raw), /surfaces/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /surfaces/);
  });

  it("rejects a changed inherited field type instead of reusing its cached array", () => {
    const inherited: { surfaces: unknown } = { surfaces: ["server"] };
    const raw: object = Object.create(inherited);
    getValidatedSettingsResult(context("same.js", raw));
    inherited.surfaces = 1;
    assert.throws(() => validateServiceNowSettings(raw), /surfaces/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /surfaces/);
  });

  it("preserves own settings that shadow invalid inherited values", () => {
    const inherited: { scope: unknown } = { scope: "global" };
    const raw: { scope?: unknown } = Object.create(inherited);
    getValidatedSettingsResult(context("same.js", raw));
    raw.scope = "scoped";
    const own = getValidatedSettingsResult(context("same.js", raw));
    assert.equal(own.settings.scope, "scoped");
    inherited.scope = 1;
    assert.equal(getValidatedSettingsResult(context("same.js", raw)), own);
    delete raw.scope;
    assert.throws(() => validateServiceNowSettings(raw), /scope/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /scope/);
  });

  it("revalidates inherited array slots used by settings parsing", () => {
    const inherited = { 0: "server" };
    Object.setPrototypeOf(inherited, Array.prototype);
    const surfaces: string[] = [];
    surfaces.length = 1;
    Object.setPrototypeOf(surfaces, inherited);
    const raw = { surfaces };
    const first = getValidatedSettingsResult(context("same.js", raw));
    assert.deepEqual(first.settings.surfaces, ["server"]);
    inherited[0] = "client";
    const second = getValidatedSettingsResult(context("same.js", raw));
    assert.notEqual(second, first);
    assert.deepEqual(second.settings.surfaces, ["client"]);
    inherited[0] = "invalid";
    assert.throws(() => validateServiceNowSettings(raw), /surfaces/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /surfaces/);
  });

  it("retains unknown own-key rejection when an inherited name becomes an own field", () => {
    const inherited = { unrelated: "ignored" };
    const raw: { unrelated?: string } = Object.create(inherited);
    getValidatedSettingsResult(context("same.js", raw));
    raw.unrelated = "reject";
    assert.throws(() => validateServiceNowSettings(raw), /unknown setting/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /unknown setting/);
  });

  it("does not evaluate inherited getters while fingerprinting raw settings", () => {
    let reads = 0;
    const inherited = {
      get scope() {
        reads += 1;
        return "global";
      },
    };
    const raw: object = Object.create(inherited);
    assert.equal(structuralFingerprint(raw), undefined);
    assert.equal(reads, 0);
    const fresh = validateServiceNowSettings(raw);
    assert.equal(fresh.settings.scope, "global");
    assert.equal(reads, 2);
    reads = 0;
    const cached = getValidatedSettingsResult(context("same.js", raw));
    assert.equal(cached.settings.scope, "global");
    assert.equal(reads, 2);
  });

  it("fingerprints effective values returned by property reads", () => {
    let scope = "global";
    const raw = new Proxy(
      { scope },
      {
        get(target, key, receiver) {
          return key === "scope" ? scope : Reflect.get(target, key, receiver);
        },
      },
    );
    const first = getValidatedSettingsResult(context("same.js", raw));
    assert.equal(first.settings.scope, "global");
    scope = "scoped";
    const second = getValidatedSettingsResult(context("same.js", raw));
    assert.notEqual(second, first);
    assert.equal(second.settings.scope, "scoped");
  });

  it("revalidates virtual Proxy array slots observed by settings parsing", () => {
    let surface = "server";
    const values: string[] = [];
    values.length = 1;
    const surfaces = new Proxy(values, {
      has(target, key) {
        return key === "0" || Reflect.has(target, key);
      },
      get(target, key, receiver) {
        return key === "0" ? surface : Reflect.get(target, key, receiver);
      },
    });
    const raw = { surfaces };
    const first = getValidatedSettingsResult(context("same.js", raw));
    assert.deepEqual(first.settings.surfaces, ["server"]);
    surface = "client";
    const second = getValidatedSettingsResult(context("same.js", raw));
    assert.notEqual(second, first);
    assert.deepEqual(second.settings.surfaces, ["client"]);
    surface = "invalid";
    assert.throws(() => validateServiceNowSettings(raw), /surfaces/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /surfaces/);
  });

  it("distinguishes actual array holes from invalid present undefined entries", () => {
    const surfaces: string[] = [];
    surfaces.length = 1;
    const raw = { surfaces };
    const first = getValidatedSettingsResult(context("same.js", raw));
    assert.equal(getValidatedSettingsResult(context("same.js", raw)), first);
    Object.defineProperty(surfaces, "0", { value: undefined });
    assert.throws(() => validateServiceNowSettings(raw), /surfaces/);
    assert.throws(() => getValidatedSettingsResult(context("same.js", raw)), /surfaces/);
  });

  it("distinguishes typed structural boundaries and handles cyclic references", () => {
    for (const [left, right] of [
      [["server", "client"], ["server,string:client"]],
      [["value", "null"], ["value,null"]],
      [["array:[string:x]"], [["x"]]],
      [["object:{}"], [{}]],
    ] as const) {
      assert.notEqual(structuralFingerprint(left), structuralFingerprint(right));
    }
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    assert.equal(typeof structuralFingerprint(cycle), "string");
    assert.equal(structuralFingerprint(cycle), structuralFingerprint(cycle));
  });
});
