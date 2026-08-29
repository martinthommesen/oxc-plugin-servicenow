import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-unsupported-date-fraction" as const;
const SHORT_FRACTION = `new Date("2025-05-07T09:05:20.78Z");`;

describe(RULE, () => {
  it("follows the all-modes Zurich and Australia release delta", () => {
    for (const javascriptMode of ["compatibility", "es5", "es2021"] as const) {
      assertInvalid(
        SHORT_FRACTION,
        RULE,
        { messageId: "unsupported", includes: "2 digits" },
        { settings: { javascriptMode, release: "zurich" } },
      );
      assertValid(SHORT_FRACTION, RULE, {
        settings: { javascriptMode, release: "australia" },
      });
      assertValid(SHORT_FRACTION, RULE, { settings: { javascriptMode } });
    }
    const parse = `Date.parse("2025-05-07T09:05:20.78Z");`;
    assertInvalid(
      parse,
      RULE,
      { messageId: "unsupported", includes: "Date.parse()" },
      { settings: { javascriptMode: "es2021", release: "zurich" } },
    );
    assertValid(parse, RULE, {
      settings: { javascriptMode: "es2021", release: "australia" },
    });
    assertValid(parse, RULE, { settings: { javascriptMode: "es2021" } });
  });

  it("uses the all-modes update for a known server surface with unknown mode", () => {
    assertInvalid(
      SHORT_FRACTION,
      RULE,
      { messageId: "unsupported" },
      {
        filename: "dates.server.js",
        settings: { release: "zurich" },
      },
    );
    assertValid(SHORT_FRACTION, RULE, {
      filename: "dates.server.js",
      settings: { release: "australia" },
    });
    assertValid(SHORT_FRACTION, RULE, { filename: "unknown.js" });
  });

  it("reports every variable fraction length accepted by the Australia parser", () => {
    for (const code of [
      `new Date("2025-05-07T09:05:20.7Z");`,
      `new Date("2025-05-07T09:05:20.78+04:00");`,
      `new Date("2025-05-07T09:05:20.7-04:00");`,
      `new Date("2025-05-07T09:05:20.1234");`,
      `new Date("2024-02-29T23:59:59.123456789Z");`,
      `new Date("2025-05-07T24:00:00.0001Z");`,
    ]) {
      assertInvalid(
        code,
        RULE,
        { messageId: "unsupported" },
        {
          settings: { javascriptMode: "es2021", release: "zurich" },
        },
      );
    }
  });

  it("resolves static strings and stable same-execution Date aliases", () => {
    for (const code of [
      `new Date("2025-05-07T09:05:" + "20.78Z");`,
      "new Date(`2025-05-07T09:05:20.78Z`);",
      `const timestamp = "2025-05-07T09:05:20." + "78Z"; new Date(timestamp);`,
      `const timestamp = "2025-05-07T09:05:20.78Z"; const alias = timestamp; new Date(alias);`,
      `const NativeDate = Date; new NativeDate("2025-05-07T09:05:20.78Z");`,
      `new globalThis.Date("2025-05-07T09:05:20.78Z");`,
      `const { Date: NativeDate } = globalThis; new NativeDate("2025-05-07T09:05:20.78Z");`,
      `Date.parse("2025-05-07T09:05:20.78Z");`,
      `Date["parse"]("2025-05-07T09:05:20.78Z");`,
      `Date.parse("2025-05-07T09:05:20.78Z", ignored);`,
      `const PlatformDate = Date; PlatformDate.parse("2025-05-07T09:05:20.78Z");`,
      `globalThis.Date.parse("2025-05-07T09:05:20.78Z");`,
      `const { Date: PlatformDate } = globalThis; PlatformDate.parse("2025-05-07T09:05:20.78Z");`,
      `Date.parse = localParse; new Date("2025-05-07T09:05:20.78Z");`,
      `Date.prototype.toString = localToString; new Date("2025-05-07T09:05:20.78Z");`,
      `installRuntime(Date); new Date("2025-05-07T09:05:20.78Z");`,
      `const NativeDate = Date; installRuntime(NativeDate); new NativeDate("2025-05-07T09:05:20.78Z");`,
    ]) {
      assertInvalid(
        code,
        RULE,
        { messageId: "unsupported" },
        {
          settings: { javascriptMode: "es2021", release: "zurich" },
        },
      );
    }
  });

  it("keeps invalid timestamps and release-invariant Date inputs silent", () => {
    for (const code of [
      `new Date("2025-05-07T09:05:20.123Z");`,
      `new Date("2025-05-07T09:05:20.Z");`,
      `new Date("2025-13-07T09:05:20.78Z");`,
      `new Date("2025-02-29T09:05:20.78Z");`,
      `new Date("2025-05-07T25:05:20.78Z");`,
      `new Date("2025-05-07T24:00:00.1Z");`,
      `new Date("2025-05-07T09:60:20.78Z");`,
      `new Date("2025-05-07T09:05:60.78Z");`,
      `new Date("2025-05-07T09:05:20.78+24:00");`,
      `new Date("2025-05-07T09:05:20.78+04:60");`,
      `new Date("2025-05-07T09:05:20.78+0400");`,
      `new Date("+002025-05-07T09:05:20.78Z");`,
      `new Date("2025-05-07 09:05:20.78Z");`,
      `new Date(1746608720780);`,
      `new Date();`,
      `new Date(2025, 4, 7);`,
      `Date("2025-05-07T09:05:20.78Z");`,
      `Reflect.construct(Date, ["2025-05-07T09:05:20.78Z"]);`,
    ]) {
      assertValid(code, RULE, {
        settings: { javascriptMode: "es2021", release: "zurich" },
      });
    }
  });

  it("keeps unknown, shadowed, mutable, and replaced identities silent", () => {
    for (const code of [
      `new Date(timestamp);`,
      `let timestamp = "2025-05-07T09:05:20.78Z"; new Date(timestamp);`,
      `new Date(timestamp); const timestamp = "2025-05-07T09:05:20.78Z";`,
      `function Date(value) { return parseLocal(value); } new Date("2025-05-07T09:05:20.78Z");`,
      `function parse(Date) { return new Date("2025-05-07T09:05:20.78Z"); }`,
      `const Date = { parse: localParse }; Date.parse("2025-05-07T09:05:20.78Z");`,
      `let NativeDate = Date; NativeDate = LocalDate; new NativeDate("2025-05-07T09:05:20.78Z");`,
      `const NativeDate = Date; function later() { return new NativeDate("2025-05-07T09:05:20.78Z"); } later();`,
      `const PlatformDate = Date; function later() { return PlatformDate.parse("2025-05-07T09:05:20.78Z"); } later();`,
      `const timestamp = "2025-05-07T09:05:20.78Z"; function later() { return new Date(timestamp); } later();`,
      `Date = LocalDate; new Date("2025-05-07T09:05:20.78Z");`,
      `globalThis.Date = LocalDate; new Date("2025-05-07T09:05:20.78Z");`,
      `Object.defineProperty(globalThis, "Date", { value: LocalDate }); new Date("2025-05-07T09:05:20.78Z");`,
      `Date.parse = localParse; Date.parse("2025-05-07T09:05:20.78Z");`,
      `Object.defineProperty(Date, "parse", { value: localParse }); Date.parse("2025-05-07T09:05:20.78Z");`,
      `Object.assign(Date, { parse: localParse }); Date.parse("2025-05-07T09:05:20.78Z");`,
      `installRuntime(Date); Date.parse("2025-05-07T09:05:20.78Z");`,
      `const parse = Date.parse; parse("2025-05-07T09:05:20.78Z");`,
      `Date.parse.call(Date, "2025-05-07T09:05:20.78Z");`,
      `Date[method]("2025-05-07T09:05:20.78Z");`,
      `class LocalDate extends Date {} new LocalDate("2025-05-07T09:05:20.78Z");`,
      `eval(source); new Date("2025-05-07T09:05:20.78Z");`,
    ]) {
      assertValid(code, RULE, {
        settings: { javascriptMode: "es2021", release: "zurich" },
      });
    }
  });

  it("does not apply the server engine contract to browser or Fluent code", () => {
    assertValid(SHORT_FRACTION, RULE, {
      filename: "form.client.js",
      settings: { javascriptMode: "es2021", release: "zurich", surfaces: ["client"] },
    });
    assertValid(SHORT_FRACTION, RULE, { filename: "metadata.now.ts" });
    assertValid(SHORT_FRACTION, RULE, {
      filename: "action.ui-action.js",
      settings: {
        javascriptMode: "es2021",
        release: "zurich",
        surfaces: ["client", "server", "ui-action"],
      },
    });
  });
});
