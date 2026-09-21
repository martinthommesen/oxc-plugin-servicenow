import type { Context, ESTree } from "@oxlint/plugins";
import {
  directPlatformGlobalName,
  getFileAnalysis,
  isAvailabilityGuarded,
  resolveConstValue,
  resolvePlatformGlobalName,
  staticPropertyName,
  type FileAnalysis,
  type ProvenanceQuery,
} from "../analysis/internal.js";
import { isFeatureAllowed } from "../engine/index.js";

/**
 * Resolve the per-file analysis for one hook. Every `before()` and visitor
 * calls this separately because oxlint forbids touching `context.sourceCode`
 * in the `createOnce` body, so state cannot be resolved once up front. Repeat
 * calls are cache hits on the same file.
 */
export function beginRuleFile(context: Context): FileAnalysis {
  return getFileAnalysis(context);
}

/**
 * Whether `node` resolves to the `property` member of the platform global
 * `owner` (for example `Reflect.apply`), through const aliases.
 */
export function isPlatformStaticMember(
  node: unknown,
  owner: string,
  property: string,
  analysis: ProvenanceQuery,
): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  return Boolean(
    value?.type === "MemberExpression" &&
    staticPropertyName(value) === property &&
    resolvePlatformGlobalName(value.object, analysis.bindings) === owner,
  );
}

/**
 * Whether reaching a platform global through the explicit `globalThis`
 * namespace `namespace` is itself supported here: the configured engine allows
 * `globalThis`, or an availability guard dominates the access.
 */
export function platformNamespaceIsSafe(
  context: Context,
  namespace: ESTree.Node,
  file: FileAnalysis,
): boolean {
  const { provenance, script } = file;
  return (
    isFeatureAllowed("global-this", script.javascriptMode, script.settings.release) ||
    isAvailabilityGuarded(
      context,
      namespace,
      provenance,
      (candidate) => directPlatformGlobalName(candidate, provenance.bindings) === "globalThis",
      {
        allowDirectAccessGuard: false,
      },
    )
  );
}
