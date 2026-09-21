import { describe, it } from "node:test";
import {
  assertDeclinesNonServerSurfaces,
  assertInvalid,
  assertValid,
  assertValidActive,
  AUSTRALIA_ES2021,
  ZURICH_ES2021,
} from "../helpers/rule-tester.js";

const RULE = "no-unsupported-static-methods" as const;

describe(RULE, () => {
  it("follows the Zurich and Australia release delta", () => {
    for (const code of [
      `Error.isError(value);`,
      `Promise.try(load);`,
      `Promise.withResolvers();`,
    ]) {
      assertInvalid(code, RULE, { messageId: "unsupported" }, ZURICH_ES2021);
      assertValid(code, RULE, AUSTRALIA_ES2021);
      assertValid(code, RULE, { settings: { javascriptMode: "es2021" } });
    }
  });

  it("reports Error.isError in classic modes without duplicating no-promise", () => {
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      assertInvalid(
        `Error.isError(value);`,
        RULE,
        { messageId: "unsupported" },
        { settings: { javascriptMode, release: "australia" } },
      );
      assertValid(`Promise.try(load); Promise.withResolvers();`, RULE, {
        settings: { javascriptMode, release: "australia" },
      });
    }
  });

  it("recognizes computed access and stable owner aliases", () => {
    for (const code of [
      `Error["isError"](value);`,
      `const PlatformError = Error; PlatformError.isError(value);`,
      `const PlatformPromise = Promise; PlatformPromise.try(load);`,
      `globalThis.Error.isError(value);`,
      `globalThis.Promise["withResolvers"]();`,
      `const { Error: PlatformError } = globalThis; PlatformError.isError(value);`,
      `const { Promise: PlatformPromise } = globalThis; PlatformPromise.try(load);`,
    ]) {
      assertInvalid(code, RULE, { messageId: "unsupported" }, ZURICH_ES2021);
    }
  });

  it("keeps shadowed, mutable, cross-execution, and dynamic identities silent", () => {
    for (const code of [
      `const Error = { isError: localCheck }; Error.isError(value);`,
      `function check(Promise) { Promise.try(load); }`,
      `let PlatformError = Error; PlatformError = LocalError; PlatformError.isError(value);`,
      `const PlatformError = Error; function later() { return PlatformError.isError(value); } later();`,
      `Error[method](value);`,
      `helper.isError(value);`,
      `eval(source); Error.isError(value);`,
    ]) {
      assertValidActive(code, RULE, ZURICH_ES2021);
    }
  });

  it("honors method availability guards when the owner is supported", () => {
    for (const code of [
      `Error.isError && Error.isError(value);`,
      `typeof Error.isError === "function" && Error.isError(value);`,
      `"isError" in Error && Error.isError(value);`,
      `if (Error.isError) Error.isError(value);`,
      `Error.isError?.(value);`,
      `function check(value) { if (!Error.isError) return false; return Error.isError(value); }`,
      `Promise.try && Promise.try(load);`,
      `typeof Promise.withResolvers === "function" && Promise.withResolvers();`,
      `"try" in Promise && Promise.try(load);`,
      `Promise.try?.(load);`,
      `const PlatformError = Error; PlatformError.isError && PlatformError.isError(value);`,
      `const PlatformPromise = Promise; typeof PlatformPromise.try === "function" && PlatformPromise.try(load);`,
      `const { Error: PlatformError } = globalThis; "isError" in PlatformError && PlatformError.isError(value);`,
    ]) {
      assertValid(code, RULE, ZURICH_ES2021);
    }
  });

  it("does not accept unrelated, invalidated, or cross-function guards", () => {
    for (const code of [
      `Promise.try && Promise.withResolvers();`,
      `if (Promise) Promise.try(load);`,
      `if (Error.isError !== null) Error.isError(value);`,
      `if (Error.isError) { Error.isError = null; Error.isError(value); }`,
      `const PlatformError = Error; if (PlatformError.isError) { PlatformError.isError = null; PlatformError.isError(value); }`,
      `if (typeof Promise.try === "function") {
  Object.defineProperty(Promise, "try", { value: undefined });
  Promise.try(load);
}`,
      `if (Error.isError) { function later() { return Error.isError(value); } later(); }`,
    ]) {
      assertInvalid(code, RULE, { messageId: "unsupported" }, ZURICH_ES2021);
    }
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    for (const code of [
      `Error.isError = localCheck; Error.isError(value);`,
      `Object.defineProperty(Error, "isError", { value: localCheck }); Error.isError(value);`,
      `Object.assign(Promise, { try: localTry }); Promise.try(load);`,
      `installPolyfills(Error); Error.isError(value);`,
    ]) {
      assertValid(code, RULE, ZURICH_ES2021);
    }
    for (const code of [
      `Error.isError = undefined; Error.isError(value);`,
      `Object.defineProperty(Error, "isError", { value: null }); Error.isError(value);`,
      `Promise.try = {}; Promise.try(load);`,
    ]) {
      assertInvalid(code, RULE, { messageId: "unsupported" }, ZURICH_ES2021);
    }
  });

  it("does not report method values, browser scripts, Fluent metadata, or unknown mode", () => {
    assertValid(`const check = Error.isError;`, RULE, ZURICH_ES2021);
    assertDeclinesNonServerSurfaces(`Error.isError(value);`, RULE, ZURICH_ES2021.settings);
    assertValid(`Error.isError(value);`, RULE);
  });
});
