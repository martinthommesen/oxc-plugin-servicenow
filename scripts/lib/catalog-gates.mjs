// Structural agreement between catalog applicability and the gate helpers
// each rule implementation calls. A declared surface or mode restriction must
// imply a gate call; removing the gate fails the catalog check instead of
// shipping a silent divergence (FINDINGS.md COR-015).

import { parseSync } from "oxc-parser";

/** Gate helpers the check recognizes in rule implementations. */
export const GATE_HELPERS = [
  "isServerInstanceContext",
  "isFluentContext",
  "isClientCapableContext",
  "isMixedUiActionContext",
  "isInstanceScript",
  "shouldDiagnoseFeature",
  "appliesOnSurface",
];

/**
 * Rule factories whose gate calls count for the rules that import them. A rule
 * file with no direct gate call must import one of these; anything else fails
 * closed so a delegation refactor cannot silently drop the agreement.
 */
export const DELEGATE_RULE_FILES = ["unsupported-constructor-rule"];

/**
 * The `ContextConfidence` floor `appliesOnSurface` and `isServerInstanceContext`
 * apply when a rule passes no `minimum` argument. A declaration equal to this
 * value is satisfied by a bare gate call; a stronger declaration must name the
 * same value at the gate.
 */
export const DEFAULT_SURFACE_CONFIDENCE = "inferred";

/** `CONTEXT_CONFIDENCE_ORDER` from `src/context/resolve.ts`. */
const CONFIDENCE_ORDER = { unknown: 0, inferred: 1, filename: 2, explicit: 3 };

/** Gate helpers whose optional trailing argument is a confidence floor. */
const CONFIDENCE_ARG_INDEX = { appliesOnSurface: 2, isServerInstanceContext: 1 };

/**
 * @typedef {object} GateCalls
 * @property {Set<string>} helpers
 * @property {string[]} surfaceArgs
 * @property {string[]} confidenceArgs
 */

/**
 * Yield every node in the parsed program, without a node-type table: the
 * check only needs call expressions, and an unrecognized container must not
 * hide one (FINDINGS.md TST-005).
 *
 * @param {unknown} node
 * @returns {Generator<Record<string, any>>}
 */
function* walk(node) {
  if (Array.isArray(node)) {
    for (const entry of node) yield* walk(entry);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = /** @type {Record<string, any>} */ (node);
  if (typeof record["type"] === "string") yield record;
  for (const key of Object.keys(record)) {
    if (key === "type" || key === "start" || key === "end") continue;
    yield* walk(record[key]);
  }
}

/**
 * Collect the gate helpers a rule really calls.
 *
 * Only executable call expressions count. Comments and string literals that
 * merely name a helper are not in the parsed program, so a removed gate left
 * behind as `// isServerInstanceContext(script)` no longer satisfies the
 * agreement (FINDINGS.md TST-005).
 *
 * Convention: a call anywhere in the rule module counts, whether it sits in
 * `before()`, a visitor, or a module-level helper. The check proves that a
 * declared restriction has an executable gate behind it; where an author puts
 * that gate is a rule-authoring choice, and `before()`-skip observability is
 * asserted separately by the rule tests.
 *
 * @param {string} source
 * @returns {GateCalls}
 */
export function collectGateCalls(source) {
  const parsed = parseSync("rule.ts", source, { lang: "ts", sourceType: "module" });
  if (parsed.errors.length > 0) {
    throw new Error(
      `gate agreement could not parse the rule source: ${parsed.errors[0]?.message ?? "unknown error"}`,
    );
  }
  /** @type {Set<string>} */
  const helpers = new Set();
  /** @type {string[]} */
  const surfaceArgs = [];
  /** @type {string[]} */
  const confidenceArgs = [];
  for (const node of walk(parsed.program)) {
    if (node["type"] !== "CallExpression") continue;
    const callee = node["callee"];
    if (callee?.type !== "Identifier" || !GATE_HELPERS.includes(callee.name)) continue;
    helpers.add(callee.name);
    const confidenceIndex =
      CONFIDENCE_ARG_INDEX[/** @type {keyof typeof CONFIDENCE_ARG_INDEX} */ (callee.name)];
    if (confidenceIndex !== undefined) {
      const confidence = node["arguments"]?.[confidenceIndex];
      confidenceArgs.push(
        confidence?.type === "Literal" && typeof confidence.value === "string"
          ? confidence.value
          : DEFAULT_SURFACE_CONFIDENCE,
      );
    }
    if (callee.name !== "appliesOnSurface") continue;
    const surface = node["arguments"]?.[1];
    if (surface?.type === "Literal" && typeof surface.value === "string") {
      surfaceArgs.push(surface.value);
    }
  }
  return { helpers, surfaceArgs, confidenceArgs };
}

/**
 * The one analysis module a rule file may import. `src/analysis/internal.ts`
 * is the enforced boundary: a rule that reaches past it can call an analysis
 * entry point that bypasses the shared per-file cache and its invariants
 * (docs/decisions.md MNT-006).
 */
export const ANALYSIS_BARREL = "internal";

/**
 * Reject a rule module that imports an analysis module other than the barrel.
 *
 * @param {string} ruleName
 * @param {string} origin
 * @param {string} ruleSource
 * @returns {void}
 */
export function assertAnalysisImportsUseBarrel(ruleName, origin, ruleSource) {
  const direct = [...ruleSource.matchAll(/from\s+"\.\.\/analysis\/([a-z0-9-]+)\.js"/g)]
    .map((match) => match[1])
    .filter((module) => module !== ANALYSIS_BARREL);
  if (direct.length === 0) return;
  throw new Error(
    `${ruleName} imports ${JSON.stringify([...new Set(direct)])} directly from src/analysis in ${origin}. Rule files import analysis only through "../analysis/${ANALYSIS_BARREL}.js"; add the symbol to that barrel instead.`,
  );
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
 * An alternative names the helpers that must all be called. `surfaceArg`
 * demands that exact `appliesOnSurface` surface; `surfaceArgAnyOf` demands one
 * of a set, which is how a multi-surface declaration stays satisfiable without
 * accepting an unrelated surface (FINDINGS.md TST-005).
 *
 * @typedef {object} GateRequirement
 * @property {Array<{ helpers: string[], surfaceArg?: string, surfaceArgAnyOf?: readonly string[] }>} alternatives
 * @property {string} describe
 */

/**
 * @param {readonly string[]} declared
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
  // A mode-restricted rule gates on `shouldDiagnoseFeature`, which carries no
  // surface argument, so the surface half of the declaration is deliberately
  // not required of it here.
  if (applicability.javascriptModes !== "n/a") {
    return {
      alternatives: [{ helpers: ["shouldDiagnoseFeature"] }],
      describe: "mode-restricted rules must call shouldDiagnoseFeature",
    };
  }
  const declared = applicability.surfaces;
  if (sameSet(declared, surfaces.server)) {
    return {
      alternatives: [{ helpers: ["isServerInstanceContext"] }],
      describe: "server-surface rules must call isServerInstanceContext",
    };
  }
  if (sameSet(declared, surfaces.client)) {
    return {
      alternatives: [
        { helpers: ["isClientCapableContext"] },
        { helpers: ["appliesOnSurface"], surfaceArgAnyOf: surfaces.client },
      ],
      describe: `client-surface rules must call isClientCapableContext or appliesOnSurface with one of ${JSON.stringify(surfaces.client)}`,
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
      `${ruleName} has an unrecognized applicability shape (authoring ${JSON.stringify(applicability.authoring)}, surfaces ${JSON.stringify(applicability.surfacesText)}); extend the gate agreement check`,
    );
  }
  const satisfied = requirement.alternatives.some((alternative) => {
    if (!alternative.helpers.every((helper) => calls.helpers.has(helper))) return false;
    if (alternative.surfaceArg !== undefined && !calls.surfaceArgs.includes(alternative.surfaceArg))
      return false;
    const anyOf = alternative.surfaceArgAnyOf;
    return anyOf === undefined || calls.surfaceArgs.some((surface) => anyOf.includes(surface));
  });
  if (!satisfied) {
    const found =
      calls.helpers.size === 0 ? "no recognized gate helper" : [...calls.helpers].join(", ");
    throw new Error(
      `${ruleName} declares a restricted applicability but ${origin} calls ${found}. ${requirement.describe}.`,
    );
  }
  assertDeclaredConfidenceIsEnforced(ruleName, origin, applicability, calls);
  assertAnalysisImportsUseBarrel(ruleName, `src/rules/${implName}.ts`, ruleSource);
  const delegate = delegateFileFor(ruleSource);
  if (delegate !== null && delegateSource !== undefined) {
    assertAnalysisImportsUseBarrel(ruleName, `src/rules/${delegate}.ts`, delegateSource);
  }
}

/**
 * A rule page publishes `minimumSurfaceConfidence` as the floor its own gate
 * enforces. Only a declaration stronger than the default can diverge silently:
 * a bare gate call already means `DEFAULT_SURFACE_CONFIDENCE`, so a stronger
 * claim must name the same value at every confidence-bearing gate call.
 *
 * @param {string} ruleName
 * @param {string} origin
 * @param {import("../../src/catalog/types.js").RuleApplicability} applicability
 * @param {GateCalls} calls
 * @returns {void}
 */
function assertDeclaredConfidenceIsEnforced(ruleName, origin, applicability, calls) {
  const declared = applicability.minimumSurfaceConfidence;
  const declaredRank = CONFIDENCE_ORDER[/** @type {keyof typeof CONFIDENCE_ORDER} */ (declared)];
  if (declaredRank === undefined) {
    throw new Error(
      `${ruleName} declares an unknown surface confidence ${JSON.stringify(declared)}`,
    );
  }
  if (declaredRank <= CONFIDENCE_ORDER[DEFAULT_SURFACE_CONFIDENCE]) return;
  const enforced = calls.confidenceArgs;
  const divergent = enforced.filter((confidence) => confidence !== declared);
  if (enforced.length === 0 || divergent.length > 0) {
    throw new Error(
      `${ruleName} declares minimum surface confidence ${JSON.stringify(declared)} but ${origin} gates on ${
        enforced.length === 0 ? "no confidence argument" : JSON.stringify(divergent)
      }. A declared floor stronger than ${JSON.stringify(DEFAULT_SURFACE_CONFIDENCE)} must be passed to every surface gate.`,
    );
  }
}
