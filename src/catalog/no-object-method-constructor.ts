import { entry } from "./entry.js";
import { noObjectMethodConstructor } from "../rules/no-object-method-constructor.js";
import * as metadata from "../catalog-metadata.js";

export const noObjectMethodConstructorEntry = entry(
  "no-object-method-constructor",
  noObjectMethodConstructor,
  {
    ...metadata.meta(metadata.engine(["es2021"]), [
      metadata.evidenceRecord(
        metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
        "The Australia engine update lists Rhino PR 1774, Don't allow methods to be used as constructors, as an ECMAScript 2021 fix.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-object-method-constructor.test.ts",
        "Fixtures cover direct and computed methods, immutable object and method aliases, generators, final-property selection, mutation, escape, shadowing, dynamic scope, releases, modes, and execution contexts.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/release-contracts.test.ts",
        "Real Oxlint and ESLint contracts verify the object-method construction delta in Zurich, Australia, and omitted-release ES2021 configurations.",
        "integration-test",
        "2026-08-24",
      ),
    ]),
    placements: [{ profile: "es2021", severity: "error" }],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "object-method-constructor-unstable-object",
        kind: "false-negative",
        description:
          "An object with any unrecognized reference, call, mutation, or escape stays silent because its method property may have been replaced before construction.",
        name: "escaped definition object",
        filename: "factory.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `const definitions = { create() {} };
configure(definitions);
new definitions.create();`,
      },
      {
        caseId: "object-method-constructor-alias-boundary",
        kind: "false-negative",
        description:
          "Destructured, mutable, conditional, and cross-execution aliases stay silent because their exact callable identity is not proven at the construction site.",
        name: "destructured method",
        filename: "factory.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `const definitions = { create() {} };
const { create: Constructor } = definitions;
new Constructor();`,
      },
      {
        caseId: "object-method-constructor-class-method",
        kind: "scope-boundary",
        description:
          "Class prototype and static methods stay outside this rule until their pre-Australia ServiceNow behavior is independently proven.",
        name: "class prototype method",
        filename: "factory.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `class Definitions { create() {} }
new Definitions.prototype.create();`,
      },
      {
        caseId: "object-method-constructor-omitted-release",
        kind: "scope-boundary",
        description:
          "Method construction stays silent when settings.servicenow.release is omitted because Zurich permits it and Australia throws.",
        name: "omitted release",
        filename: "factory.server.js",
        settings: { javascriptMode: "es2021" },
        code: `const definitions = { create() {} };
new definitions.create();`,
      },
    ],
    title: "No object method constructor",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "ServiceNow Australia enforces ECMAScript's non-constructible shorthand object methods, while Zurich's ES2021 engine incorrectly permits them. This rule reports direct `new` calls through a stable object or method alias only when method identity cannot have changed.",
    bad: [
      {
        name: "shorthand method used as a constructor in Australia",
        filename: "factory.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `const definitions = { Task() {} };
const task = new definitions.Task();`,
      },
    ],
    good: [
      {
        name: "function-valued constructible property",
        filename: "factory.server.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `const definitions = { Task: function Task() {} };
const task = new definitions.Task();`,
      },
    ],
  },
);
