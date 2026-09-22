import { entry } from "./entry.js";
import { noUnhoistedBlockFunctionUse } from "../rules/no-unhoisted-block-function-use.js";
import * as metadata from "../catalog-metadata.js";

export const noUnhoistedBlockFunctionUseEntry = entry(
  "no-unhoisted-block-function-use",
  noUnhoistedBlockFunctionUse,
  {
    ...metadata.meta(metadata.engine(metadata.ALL_INSTANCE_MODES), [
      metadata.evidenceRecord(
        metadata.SN_JS_ENGINE_UPDATES_AUSTRALIA,
        "The Australia engine update lists Rhino PR 1806, Fix hoisting behavior, as a fix applicable to all JavaScript modes.",
        "manual",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-unhoisted-block-function-use.test.ts",
        "Fixtures cover nested blocks, loops, try/catch, reads, shadowing, deferred bodies, mutation, dynamic scope, switch boundaries, releases, modes, and execution contexts.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/release-contracts.test.ts",
        "Real Oxlint and ESLint contracts verify the nested-block hoisting delta in Zurich, Australia, omitted-release, ES5, and ES2021 configurations.",
        "integration-test",
        "2026-08-24",
      ),
    ]),
    placements: [
      { profile: "classic-es5", severity: "error" },
      { profile: "es2021", severity: "error" },
    ],
    optionDescriptor: undefined,
    limitationCases: [
      {
        caseId: "unhoisted-block-function-deferred-body",
        kind: "false-negative",
        description:
          "References inside nested functions or classes stay silent because their invocation can occur after the block declaration has executed.",
        name: "deferred callback",
        filename: "helpers.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `{
  const callback = () => helper();
  function helper() { return 1; }
  callback();
}`,
      },
      {
        caseId: "unhoisted-block-function-mutated-binding",
        kind: "false-negative",
        description:
          "A reassigned function binding or direct eval/with makes pre-declaration identity unknown, so every matching use in that file stays silent.",
        name: "reassigned block function",
        filename: "helpers.server.js",
        settings: { javascriptMode: "es5", release: "zurich" },
        code: `{
  helper = replacement;
  helper();
  function helper() { return 1; }
}`,
      },
      {
        caseId: "unhoisted-block-function-switch-case",
        kind: "scope-boundary",
        description:
          "Function declarations directly owned by switch cases stay silent because Rhino PR 1806 explicitly left switch hoisting outside its proven implementation.",
        name: "direct switch-case declaration",
        filename: "helpers.server.js",
        settings: { javascriptMode: "es2021", release: "zurich" },
        code: `switch (kind) {
  case "one":
    helper();
    function helper() { return 1; }
}`,
      },
      {
        caseId: "unhoisted-block-function-omitted-release",
        kind: "scope-boundary",
        description:
          "Pre-declaration uses stay silent when settings.servicenow.release is omitted because Zurich and Australia have different hoisting behavior.",
        name: "omitted release",
        filename: "helpers.server.js",
        settings: { javascriptMode: "es2021" },
        code: `{
  helper();
  function helper() { return 1; }
}`,
      },
    ],
    title: "No unhoisted block-function use",
    family: "engine",
    severity: "error",
    fixable: false,
    hasSuggestions: false,
    description:
      "Before Australia, ServiceNow does not correctly hoist nested block function declarations to block entry. This rule reports binding-proven reads before the declaration in the same execution body across every instance JavaScript mode.",
    bad: [
      {
        name: "nested helper called before declaration in Zurich",
        filename: "script-include.js",
        settings: { javascriptMode: "es5", release: "zurich" },
        code: `function calculate() {
  try {
    return add(2, 3);
    function add(left, right) { return left + right; }
  } catch (error) {
    return 0;
  }
}`,
      },
    ],
    good: [
      {
        name: "helper declared before use",
        filename: "script-include.js",
        settings: { javascriptMode: "es5", release: "zurich" },
        code: `function calculate() {
  try {
    function add(left, right) { return left + right; }
    return add(2, 3);
  } catch (error) {
    return 0;
  }
}`,
      },
      {
        name: "Australia block hoisting",
        filename: "script-include.js",
        settings: { javascriptMode: "es2021", release: "australia" },
        code: `{
  helper();
  function helper() { return 1; }
}`,
      },
    ],
  },
);
