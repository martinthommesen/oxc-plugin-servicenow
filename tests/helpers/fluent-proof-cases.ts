import type { RuleName } from "../../src/rules/index.js";

export interface FluentProofCase {
  readonly name: string;
  readonly rule: RuleName;
  readonly code: string;
  readonly expected: readonly string[];
  readonly offsetFreeExpected: readonly string[];
}

const FACTORY = 'import { BusinessRule } from "@servicenow/sdk/core";\n';
const LOCAL = "function local(config) { return config; }\n";
const CALL = 'T({ name: "x_test", table: "incident" })';
const ALIAS = `${FACTORY}${LOCAL}let T = BusinessRule;\n`;
const CONFIG = 'const config = { $id: Now.ID["test"], name: "x_test", table: "incident" };\n';

function aliasCase(name: string, code: string, expected: readonly string[]): FluentProofCase {
  return { name, rule: "require-fluent-id", code, expected, offsetFreeExpected: [] };
}

function propertyCase(name: string, body: string, expected: readonly string[]): FluentProofCase {
  return {
    name,
    rule: "require-fluent-id",
    code: `${FACTORY}${CONFIG}${body}`,
    expected,
    offsetFreeExpected: expected,
  };
}

export const FLUENT_WRITE_PROOF_CASES: readonly FluentProofCase[] = [
  aliasCase("factory call inside its pending assignment", `${ALIAS}T = local(${CALL});`, [
    "missing",
  ]),
  aliasCase("factory call inside a pending compound assignment", `${ALIAS}T ||= local(${CALL});`, [
    "missing",
  ]),
  aliasCase(
    "factory call inside a pending var redeclaration",
    `${FACTORY}${LOCAL}var T = BusinessRule;\nvar T = local(${CALL});`,
    ["missing"],
  ),
  aliasCase(
    "completed nested write supplies the pending RHS",
    `${FACTORY}${LOCAL}let T = local;\nT = local((T = BusinessRule, ${CALL}));`,
    ["missing"],
  ),
  aliasCase(
    "pending pattern write preserves the RHS factory",
    `${ALIAS}({ T } = local(${CALL}));`,
    ["missing"],
  ),
  aliasCase(
    "for-of iterable runs before the loop write",
    `${ALIAS}for (T of [${CALL}]) {}\n${CALL};`,
    ["missing"],
  ),
  aliasCase(
    "object pattern invalidates the later factory",
    `${ALIAS}({ T } = { T: local });\n${CALL};`,
    [],
  ),
  aliasCase("array pattern invalidates the later factory", `${ALIAS}[T] = [local];\n${CALL};`, []),
  aliasCase(
    "for-of target invalidates the later factory",
    `${ALIAS}for (T of [local]) {}\n${CALL};`,
    [],
  ),
  aliasCase(
    "for-in target invalidates the later factory",
    `${ALIAS}for (T in { local }) {}\n${CALL};`,
    [],
  ),
  aliasCase(
    "var loop target invalidates the later factory",
    `${FACTORY}${LOCAL}var T = BusinessRule;\nfor (var T of [local]) {}\n${CALL};`,
    [],
  ),
  aliasCase(
    "unsupported write leaves the earlier call intact",
    `${ALIAS}${CALL};\n[T] = [local];\n${CALL};`,
    ["missing"],
  ),
  aliasCase(
    "function pattern write makes execution order uncertain",
    `${ALIAS}${CALL};\nfunction mutate() { [T] = [local]; }`,
    [],
  ),
  aliasCase(
    "function use cannot trust a pattern write",
    `${ALIAS}function run() { ${CALL}; }\n[T] = [local];`,
    [],
  ),
  {
    ...aliasCase(
      "pattern write to a shadowed binding preserves the import alias",
      `${ALIAS}{ let T = local; [T] = [local]; }\n${CALL};`,
      ["missing"],
    ),
    offsetFreeExpected: ["missing"],
  },
];

export const FLUENT_PROPERTY_PROOF_CASES: readonly FluentProofCase[] = [
  propertyCase(
    "spread-only configuration has unknown ID presence",
    "BusinessRule({ ...config });",
    [],
  ),
  propertyCase("later spread can replace a raw ID", 'BusinessRule({ $id: "raw", ...config });', []),
  propertyCase(
    "later spread can replace a sys_id",
    'BusinessRule({ $id: "0123456789abcdef0123456789abcdef", ...config });',
    [],
  ),
  propertyCase(
    "explicit canonical ID after a spread is known",
    'BusinessRule({ ...config, $id: Now.ID["test"] });',
    [],
  ),
  propertyCase(
    "explicit raw ID after a spread remains diagnosable",
    'BusinessRule({ ...config, $id: "raw" });',
    ["preferNowId"],
  ),
  propertyCase(
    "dynamic computed property may supply an ID",
    'BusinessRule({ [getKey()]: Now.ID["test"], name: "x_test" });',
    [],
  ),
  propertyCase(
    "later computed property may replace an ID",
    'BusinessRule({ $id: "raw", [getKey()]: Now.ID["test"] });',
    [],
  ),
  propertyCase(
    "explicit ID after a computed property is known",
    'BusinessRule({ [getKey()]: "other", $id: "raw" });',
    ["preferNowId"],
  ),
  propertyCase("literal computed ID is an exact property", 'BusinessRule({ ["$id"]: "raw" });', [
    "preferNowId",
  ]),
  propertyCase(
    "known unrelated computed key proves ID absence",
    'BusinessRule({ ["name"]: "x_test", table: "incident" });',
    ["missing"],
  ),
  {
    name: "later spread prevents a stale table-name comparison",
    rule: "fluent-naming-convention",
    code: 'import { Table } from "@servicenow/sdk/core";\nconst config = { name: "x_test" };\nexport const x_test = Table({ name: "Bad Name", ...config });',
    expected: [],
    offsetFreeExpected: [],
  },
  {
    name: "explicit table name after a spread remains diagnosable",
    rule: "fluent-naming-convention",
    code: 'import { Table } from "@servicenow/sdk/core";\nconst config = { name: "x_test" };\nexport const x_test = Table({ ...config, name: "x_other" });',
    expected: ["tableExport"],
    offsetFreeExpected: ["tableExport"],
  },
];

export const FLUENT_DIRECTIVE_PROOF_CASES: readonly FluentProofCase[] = [
  {
    name: "brace-free alternate directive attaches",
    rule: "fluent-directives",
    code: "if (condition) work(); else\n// @fluent-ignore\nother();",
    expected: [],
    offsetFreeExpected: [],
  },
  {
    name: "brace-free consequent directive attaches",
    rule: "fluent-directives",
    code: "if (condition)\n// @fluent-ignore\nwork(); else other();",
    expected: [],
    offsetFreeExpected: [],
  },
  {
    name: "mixed block and alternate directive attaches",
    rule: "fluent-directives",
    code: "if (condition) { work(); } else\n// @fluent-ignore\nother();",
    expected: [],
    offsetFreeExpected: [],
  },
  {
    name: "mixed consequent and block directive attaches",
    rule: "fluent-directives",
    code: "if (condition)\n// @fluent-ignore\nwork(); else { other(); }",
    expected: [],
    offsetFreeExpected: [],
  },
  {
    name: "nested brace-free alternate directive attaches",
    rule: "fluent-directives",
    code: "if (outer)\nif (inner) work(); else\n// @fluent-ignore\nother();",
    expected: [],
    offsetFreeExpected: [],
  },
  {
    name: "block-tail directive remains dangling",
    rule: "fluent-directives",
    code: "if (condition) {\nwork();\n// @fluent-ignore\n} else other();",
    expected: ["dangling"],
    offsetFreeExpected: ["dangling"],
  },
  {
    name: "alternate directive with a blank line remains misplaced",
    rule: "fluent-directives",
    code: "if (condition) work(); else\n// @fluent-ignore\n\nother();",
    expected: ["misplaced"],
    offsetFreeExpected: ["misplaced"],
  },
];

export const FLUENT_SCOPE_PROOF_CASES: readonly FluentProofCase[] = [
  {
    name: "resolves outer initializers in their declaration scope",
    rule: "require-fluent-id",
    code: 'import { BusinessRule } from "@servicenow/sdk/core";\nconst Alias = BusinessRule;\nfunction use() { const BusinessRule = (config) => config; Alias({ name: "x_test" }); }',
    expected: ["missing"],
    offsetFreeExpected: ["missing"],
  },
  {
    name: "keeps an initializer shadow local when its alias escapes the scope",
    rule: "require-fluent-id",
    code: 'import { BusinessRule } from "@servicenow/sdk/core";\nlet Alias;\n{ const BusinessRule = (config) => config; Alias = BusinessRule; }\nAlias({ name: "x_test" });',
    expected: [],
    offsetFreeExpected: [],
  },
];

export function deepFluentAliasFixture(): string {
  const lines = [FACTORY, "const a0 = BusinessRule;"];
  for (let index = 1; index < 6_000; index += 1) lines.push(`const a${index} = a${index - 1};`);
  lines.push('a5999({ name: "x_test", table: "incident" });');
  return lines.join("\n");
}
