import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {
  assertDeclinesNonServerSurfaces,
  AUSTRALIA_ES2021,
  ZURICH_ES2021,
} from "../helpers/rule-tester.js";

const RULE = "no-unsupported-static-methods" as const;

describe(RULE, () => {
  const { expectInvalid, expectActive, expectValid } = ruleTester(
    "no-unsupported-static-methods",
    ZURICH_ES2021,
    { messageId: "unsupported" },
  );

  it("invalidates method availability after later compound-condition writes", () => {
    for (const mutation of [
      "Error.isError = undefined",
      'Object.defineProperty(Error, "isError", { value: null })',
    ]) {
      expectInvalid(
        `if (typeof Error.isError === "function" && (${mutation}, true)) { Error.isError(value); }`,
      );
      expectActive(
        `if ((${mutation}, true) && typeof Error.isError === "function") { Error.isError(value); }`,
      );
    }
  });

  it("follows the Zurich and Australia release delta", () => {
    for (const code of [
      `Error.isError(value);`,
      `Promise.try(load);`,
      `Promise.withResolvers();`,
    ]) {
      expectInvalid(code);
      expectValid(code, AUSTRALIA_ES2021);
      expectValid(code, { settings: { javascriptMode: "es2021" } });
    }
  });

  it("reports Error.isError in classic modes without duplicating no-promise", () => {
    for (const javascriptMode of ["compatibility", "es5"] as const) {
      expectInvalid(`Error.isError(value);`, undefined, {
        settings: { javascriptMode, release: "australia" },
      });
      expectValid(`Promise.try(load); Promise.withResolvers();`, {
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
      expectInvalid(code);
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
      expectActive(code);
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
      expectValid(code);
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
      expectInvalid(code);
    }
  });

  it("allows callable polyfills but reports non-callable replacements", () => {
    for (const code of [
      `Error.isError = localCheck; Error.isError(value);`,
      `Object.defineProperty(Error, "isError", { value: localCheck }); Error.isError(value);`,
      `Object.assign(Promise, { try: localTry }); Promise.try(load);`,
      `installPolyfills(Error); Error.isError(value);`,
    ]) {
      expectValid(code);
    }
    for (const code of [
      `Error.isError = undefined; Error.isError(value);`,
      `Object.defineProperty(Error, "isError", { value: null }); Error.isError(value);`,
      `Promise.try = {}; Promise.try(load);`,
    ]) {
      expectInvalid(code);
    }
  });

  it("does not report method values, browser scripts, Fluent metadata, or unknown mode", () => {
    expectValid(`const check = Error.isError;`);
    assertDeclinesNonServerSurfaces(`Error.isError(value);`, RULE, ZURICH_ES2021.settings);
    expectValid(`Error.isError(value);`, {});
  });
});
