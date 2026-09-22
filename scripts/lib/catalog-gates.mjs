// Structural agreement between catalog applicability and the gate helpers
// each rule implementation calls. A declared surface or mode restriction must
// imply a gate call; removing the gate fails the catalog check instead of
// shipping a silent divergence (FINDINGS.md COR-015).

/** Gate helpers the check recognizes in rule implementations. */
export const GATE_HELPERS = [
  "isServerInstanceContext",
  "isFluentContext",
  "isClientCapableContext",
  "isMixedUiActionContext",
  "isInstanceScript",
  "shouldDiagnoseFeature",
  "appliesOnSurface",
  "appliesToInstanceScripts",
];

/**
 * Rule factories whose gate calls count for the rules that import them. A rule
 * file with no direct gate call must import one of these; anything else fails
 * closed so a delegation refactor cannot silently drop the agreement.
 */
export const DELEGATE_RULE_FILES = ["unsupported-constructor-rule"];

/**
 * @typedef {object} GateCalls
 * @property {Set<string>} helpers
 * @property {string[]} surfaceArgs
 */

/**
 * @param {string} source
 * @returns {GateCalls}
 */
export function collectGateCalls(source) {
  /** @type {Set<string>} */
  const helpers = new Set();
  for (const name of GATE_HELPERS) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(source)) helpers.add(name);
  }
  /** @type {string[]} */
  const surfaceArgs = [];
  for (const match of source.matchAll(
    /appliesOnSurface\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*["']([^"']+)["']/g,
  )) {
    if (match[1] !== undefined) surfaceArgs.push(match[1]);
  }
  return { helpers, surfaceArgs };
}

/**
 * @param {string} ruleName
 * @param {string} catalogSource
 * @returns {string}
 */
export function implementationFileFor(ruleName, catalogSource) {
  const match = catalogSource.match(/\.\.\/rules\/([a-z0-9-]+)\.js/);
  if (!match?.[1]) throw new Error(`${ruleName} catalog entry imports no rule implementation`);
  return match[1];
}

/**
 * @param {string} ruleSource
 * @returns {string | null}
 */
export function delegateFileFor(ruleSource) {
  for (const delegate of DELEGATE_RULE_FILES) {
    if (ruleSource.includes(`from "./${delegate}.js"`)) return delegate;
  }
  return null;
}

/**
 * The catalog stores surfaces as a rendered sentence; recover the declared
 * list. Fails closed on unrecognized prose so a generator change breaks the
 * check loudly instead of weakening it.
 *
 * @param {string} sentence
 * @returns {string[] | null}
 */
export function parseDeclaredSurfaces(sentence) {
  if (sentence === "Fluent `.now.ts` metadata only.") return ["fluent"];
  const match = /^Applies to (.+?) when those surfaces/.exec(sentence);
  if (!match?.[1]) return null;
  return match[1].split(", ");
}

/**
 * @typedef {object} GateRequirement
 * @property {Array<{ helpers: string[], surfaceArg?: string }>} alternatives
 * @property {string} describe
 */

/**
 * @param {string[]} declared
 * @param {readonly string[]} expected
 * @returns {boolean}
 */
function sameSet(declared, expected) {
  return (
    declared.length === expected.length && declared.every((surface) => expected.includes(surface))
  );
}

/**
 * @param {import("../../src/catalog/types.js").RuleApplicability} applicability
 * @param {{ server: readonly string[], client: readonly string[], classic: readonly string[] }} surfaces
 * @returns {GateRequirement | null}
 */
export function requirementFor(applicability, surfaces) {
  if (applicability.authoring === "fluent") {
    return {
      alternatives: [{ helpers: ["isFluentContext"] }],
      describe: "Fluent rules must call isFluentContext",
    };
  }
  if (applicability.authoring !== "classic") return null;
  if (applicability.javascriptModes !== "n/a") {
    return {
      alternatives: [{ helpers: ["shouldDiagnoseFeature"] }],
      describe: "mode-restricted rules must call shouldDiagnoseFeature",
    };
  }
  const declared = parseDeclaredSurfaces(applicability.surfaces);
  if (!declared) return null;
  if (sameSet(declared, surfaces.server)) {
    return {
      alternatives: [{ helpers: ["isServerInstanceContext"] }],
      describe: "server-surface rules must call isServerInstanceContext",
    };
  }
  if (sameSet(declared, surfaces.client)) {
    return {
      alternatives: [{ helpers: ["isClientCapableContext"] }, { helpers: ["appliesOnSurface"] }],
      describe: "client-surface rules must call isClientCapableContext or appliesOnSurface",
    };
  }
  if (declared.length === 1 && declared[0] !== undefined) {
    return {
      alternatives: [{ helpers: ["appliesOnSurface"], surfaceArg: declared[0] }],
      describe: `single-surface rules must call appliesOnSurface with ${JSON.stringify(declared[0])}`,
    };
  }
  if (sameSet(declared, surfaces.classic)) {
    return {
      alternatives: [
        { helpers: ["isInstanceScript"] },
        { helpers: ["isServerInstanceContext", "appliesOnSurface"] },
      ],
      describe:
        "universal-surface rules must call isInstanceScript or both isServerInstanceContext and appliesOnSurface",
    };
  }
  return null;
}

/**
 * @param {object} input
 * @param {string} input.ruleName
 * @param {string} input.implName
 * @param {import("../../src/catalog/types.js").RuleApplicability} input.applicability
 * @param {string} input.ruleSource
 * @param {string | undefined} [input.delegateSource]
 * @param {{ server: readonly string[], client: readonly string[], classic: readonly string[] }} input.surfaces
 * @returns {void}
 */
export function assertRuleGateAgreement(input) {
  const { ruleName, implName, applicability, ruleSource, delegateSource, surfaces } = input;
  let calls = collectGateCalls(ruleSource);
  let origin = `src/rules/${implName}.ts`;
  // Only a file without its own before() hook may inherit its gate from a
  // delegate factory. A hook that calls no gate helper is the defect this
  // check exists to catch, not a delegation.
  if (
    calls.helpers.size === 0 &&
    delegateSource !== undefined &&
    !/\bbefore\s*\(\s*\)/.test(ruleSource)
  ) {
    calls = collectGateCalls(delegateSource);
    origin += " or its rule delegate";
  }
  const requirement = requirementFor(applicability, surfaces);
  if (!requirement) {
    throw new Error(
      `${ruleName} has an unrecognized applicability shape (authoring ${JSON.stringify(applicability.authoring)}, surfaces ${JSON.stringify(applicability.surfaces)}); extend the gate agreement check`,
    );
  }
  const satisfied = requirement.alternatives.some(
    (alternative) =>
      alternative.helpers.every((helper) => calls.helpers.has(helper)) &&
      (alternative.surfaceArg === undefined || calls.surfaceArgs.includes(alternative.surfaceArg)),
  );
  if (!satisfied) {
    const found =
      calls.helpers.size === 0 ? "no recognized gate helper" : [...calls.helpers].join(", ");
    throw new Error(
      `${ruleName} declares a restricted applicability but ${origin} calls ${found}. ${requirement.describe}.`,
    );
  }
}
