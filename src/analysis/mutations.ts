import type { ESTree } from "@oxlint/plugins";
import { nodeEnd, nodeStart } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import type { ProvenanceQuery } from "./provenance.js";
import type { JavaScriptMode } from "../types.js";
import {
  affectingPathKeys,
  allocationPropertyWasWritten,
  allocationValue,
  objectPropertyKey,
  pathWasWritten,
  type MutableMutationFacts,
  type MutationIndex,
  type MutationRuntime,
} from "./mutation-facts.js";
import { buildMutationIndex } from "./mutation-index.js";
export type { MutationRuntime } from "./mutation-facts.js";

export interface MutationQuery {
  /** True when a callable replacement may have been installed for the global. */
  isGlobalWritten(name: string): boolean;
  /** True when a callable replacement may have been installed for the path. */
  isGlobalPathWritten(path: readonly string[]): boolean;
  /** True when a callable replacement may have been installed on the object. */
  isObjectPropertyWritten(object: unknown, property: string): boolean;
  /** True when any write or escape makes the platform global's identity uncertain. */
  isGlobalAuthorityLost(name: string): boolean;
  /**
   * True when any write or escape makes the platform path's identity uncertain.
   * A trusted source can be ignored only when it is the sole origin of every matching fact.
   */
  isGlobalPathAuthorityLost(path: readonly string[], ignoredSource?: ESTree.Node): boolean;
  /** True when any write or escape makes the object's platform method identity uncertain. */
  isObjectPropertyAuthorityLost(object: unknown, property: string): boolean;
  /** Authority loss that may execute before this use in the same run. */
  isGlobalAuthorityLostAt(name: string, use: ESTree.Node): boolean;
  /** Path authority loss that may execute before this use in the same run. */
  isGlobalPathAuthorityLostAt(
    path: readonly string[],
    use: ESTree.Node,
    ignoredSource?: ESTree.Node,
  ): boolean;
  /** Object-method authority loss that may execute before this use in the same run. */
  isObjectPropertyAuthorityLostAt(object: unknown, property: string, use: ESTree.Node): boolean;
}

export function createMutationQuery(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
  provenance: ProvenanceQuery,
  javascriptMode: JavaScriptMode,
  runtime: MutationRuntime = "instance",
): MutationQuery {
  let index: MutationIndex | undefined;
  const getIndex = () =>
    (index ??= buildMutationIndex(
      program,
      bindings,
      bindingWrites,
      provenance,
      javascriptMode,
      runtime,
    ));
  const boundaryStatements = (boundary: ESTree.Node): readonly ESTree.Statement[] | null => {
    if (boundary.type === "Program" || boundary.type === "BlockStatement") return boundary.body;
    if (
      (boundary.type === "FunctionDeclaration" ||
        boundary.type === "FunctionExpression" ||
        boundary.type === "ArrowFunctionExpression") &&
      boundary.body &&
      boundary.body.type === "BlockStatement"
    ) {
      return boundary.body.body;
    }
    return null;
  };
  const boundaryStatementIndex = (node: ESTree.Node, boundary: ESTree.Node): number | null => {
    const statements = boundaryStatements(boundary);
    if (!statements) return null;
    const start = nodeStart(node);
    const end = nodeEnd(node);
    if (start < 0 || end < 0) return null;
    for (let statementIndex = 0; statementIndex < statements.length; statementIndex += 1) {
      const statement = statements[statementIndex]!;
      if (nodeStart(statement) <= start && end <= nodeEnd(statement)) return statementIndex;
    }
    return null;
  };
  const sourceMayAffectUse = (source: ESTree.Node | null, use: ESTree.Node): boolean => {
    if (!source) return true;
    const sourceBoundary = bindings.executionBoundaryForNode(source);
    const useBoundary = bindings.executionBoundaryForNode(use);
    if (!sourceBoundary || sourceBoundary.id !== useBoundary?.id) return true;
    const sourceStatement = boundaryStatementIndex(source, sourceBoundary.block);
    const useStatement = boundaryStatementIndex(use, sourceBoundary.block);
    return sourceStatement === null || useStatement === null || sourceStatement <= useStatement;
  };
  const sourcesMayAffectUse = (
    sources: ReadonlySet<ESTree.Node | null> | undefined,
    use: ESTree.Node,
    ignoredSource?: ESTree.Node,
  ): boolean =>
    !sources ||
    [...sources].some((source) => source !== ignoredSource && sourceMayAffectUse(source, use));
  const keyedFactMayAffectUse = (
    facts: ReadonlySet<string>,
    sources: ReadonlyMap<string, ReadonlySet<ESTree.Node | null>>,
    keys: readonly string[],
    use: ESTree.Node,
    ignoredSource?: ESTree.Node,
  ): boolean =>
    keys.some((key) => facts.has(key) && sourcesMayAffectUse(sources.get(key), use, ignoredSource));
  const propertyWasWritten = (object: unknown, property: string, authority: boolean): boolean => {
    const objectId = provenance.ofExpression(object)?.objectId;
    const allocation = allocationValue(object, bindings, bindingWrites, authority);
    const facts: MutableMutationFacts = authority ? getIndex().authority : getIndex().callable;
    return (
      facts.objectPropertyWildcards.has(property) ||
      facts.objectPropertyWildcards.has("*") ||
      allocationPropertyWasWritten(facts.allocationProperties, allocation, property) ||
      (objectId !== undefined &&
        (facts.objectProperties.has(objectPropertyKey(objectId, property)) ||
          facts.objectProperties.has(objectPropertyKey(objectId, "*"))))
    );
  };
  return Object.freeze({
    isGlobalWritten(name: string) {
      return getIndex().callable.globals.has(name) || getIndex().callable.globals.has("*");
    },
    isGlobalPathWritten(path: readonly string[]) {
      return pathWasWritten(getIndex().callable.globalPaths, path);
    },
    isObjectPropertyWritten(object: unknown, property: string) {
      return propertyWasWritten(object, property, false);
    },
    isGlobalAuthorityLost(name: string) {
      return getIndex().authority.globals.has(name) || getIndex().authority.globals.has("*");
    },
    isGlobalPathAuthorityLost(path: readonly string[], ignoredSource?: ESTree.Node) {
      const current = getIndex();
      if (!ignoredSource) return pathWasWritten(current.authority.globalPaths, path);
      for (const key of affectingPathKeys(path)) {
        if (!current.authority.globalPaths.has(key)) continue;
        const sources = current.authorityGlobalPathSources.get(key);
        if (!sources) return true;
        for (const source of sources) {
          if (source !== ignoredSource) return true;
        }
      }
      return false;
    },
    isObjectPropertyAuthorityLost(object: unknown, property: string) {
      return propertyWasWritten(object, property, true);
    },
    isGlobalAuthorityLostAt(name: string, use: ESTree.Node) {
      const current = getIndex();
      return keyedFactMayAffectUse(
        current.authority.globals,
        current.authorityGlobalSources,
        [name, "*"],
        use,
      );
    },
    isGlobalPathAuthorityLostAt(
      path: readonly string[],
      use: ESTree.Node,
      ignoredSource?: ESTree.Node,
    ) {
      const current = getIndex();
      return keyedFactMayAffectUse(
        current.authority.globalPaths,
        current.authorityGlobalPathSources,
        affectingPathKeys(path),
        use,
        ignoredSource,
      );
    },
    isObjectPropertyAuthorityLostAt(object: unknown, property: string, use: ESTree.Node) {
      const current = getIndex();
      if (
        keyedFactMayAffectUse(
          current.authority.objectPropertyWildcards,
          current.authorityObjectPropertyWildcardSources,
          [property, "*"],
          use,
        )
      ) {
        return true;
      }
      const allocation = allocationValue(object, bindings, bindingWrites, true);
      if (allocation) {
        const properties = current.authority.allocationProperties.get(allocation);
        const sources = current.authorityAllocationPropertySources.get(allocation);
        if (
          properties &&
          sources &&
          keyedFactMayAffectUse(properties, sources, [property, "*"], use)
        ) {
          return true;
        }
      }
      const objectId = provenance.ofExpression(object)?.objectId;
      return (
        objectId !== undefined &&
        keyedFactMayAffectUse(
          current.authority.objectProperties,
          current.authorityObjectPropertySources,
          [objectPropertyKey(objectId, property), objectPropertyKey(objectId, "*")],
          use,
        )
      );
    },
  });
}
