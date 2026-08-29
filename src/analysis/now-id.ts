import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  isNode,
  propertyKeyName,
  staticMemberChain,
  unwrapExpression,
  walk,
} from "../utils/ast.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface NowIdMisuse {
  node: ESTree.Node;
  key: string | null;
}

export interface DuplicateFluentId {
  node: ESTree.Node;
  key: string;
}

export interface StaticNowIdFact {
  readonly kind: "static";
  readonly key: string;
}

export interface UnknownNowIdFact {
  readonly kind: "unknown";
}

/** A tagged fact prevents the valid static key `"unknown"` from colliding. */
export type NowIdFact = StaticNowIdFact | UnknownNowIdFact | null;

const UNKNOWN_NOW_ID: UnknownNowIdFact = Object.freeze({ kind: "unknown" });

function staticNowId(key: string): StaticNowIdFact {
  return Object.freeze({ kind: "static", key });
}

function unknownNowId(): UnknownNowIdFact {
  return UNKNOWN_NOW_ID;
}

export function mergeNowIdFacts(left: NowIdFact, right: NowIdFact): NowIdFact {
  if (left === right) return left;
  if (left === null || right === null) return null;
  if (left?.kind === "static" && right?.kind === "static" && left.key === right.key) {
    return staticNowId(left.key);
  }
  return unknownNowId();
}

export function nowIdFactsEqual(left: NowIdFact, right: NowIdFact): boolean {
  if (left === right) return true;
  return left?.kind === "static" && right?.kind === "static" && left.key === right.key;
}

function nowRootIdentifier(node: ESTree.Node): ESTree.Node | null {
  let current: unknown = unwrapExpression(node);
  while (isNode(current) && current.type === "MemberExpression") {
    current = unwrapExpression((current as ESTree.MemberExpression).object);
  }
  return isNode(current) && getName(current) ? current : null;
}

function canonicalNowNamespace(
  node: ESTree.Node,
  analysis: ProvenanceQuery,
  seen: Set<number>,
): boolean {
  if (seen.size >= 512) return false;
  const expr = unwrapExpression(node);
  if (!isNode(expr) || expr.type !== "Identifier") return false;
  if (getName(expr) === "Now" && analysis.isPlatformGlobal(expr)) return true;
  const name = getName(expr);
  if (!name) return false;
  const binding = analysis.bindings.resolve(name, expr);
  if (!binding || seen.has(binding.id) || binding.kind !== "const") return false;
  if (binding.node.type !== "VariableDeclarator") return false;
  const declaration = binding.node as ESTree.VariableDeclarator;
  if (!isNode(declaration.id) || declaration.id.type !== "Identifier" || !isNode(declaration.init))
    return false;
  seen.add(binding.id);
  return canonicalNowNamespace(declaration.init, analysis, seen);
}

/** True when `Now` is the platform global or a proven immutable alias. */
export function isCanonicalNow(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
  const root = nowRootIdentifier(node);
  return Boolean(root && canonicalNowNamespace(root, analysis, new Set()));
}

function isCanonicalNowIdNamespace(
  node: ESTree.Node,
  analysis: ProvenanceQuery,
  seen: Set<number>,
): boolean {
  if (seen.size >= 512) return false;
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return false;
  if (expr.type === "MemberExpression" && staticPropertyName(expr) === "ID") {
    return isCanonicalNow((expr as ESTree.MemberExpression).object as ESTree.Node, analysis);
  }
  const name = getName(expr);
  if (!name) return false;
  const binding = analysis.bindings.resolve(name, expr);
  if (!binding || binding.kind !== "const" || seen.has(binding.id)) return false;
  if (binding.node.type !== "VariableDeclarator") return false;
  const declaration = binding.node as ESTree.VariableDeclarator;
  if (!isNode(declaration.init)) return false;
  seen.add(binding.id);
  return isCanonicalNowIdNamespace(declaration.init, analysis, seen);
}

export function isCanonicalNowId(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
  const expr = unwrapExpression(node);
  if (!isNode(expr) || expr.type !== "MemberExpression") return false;
  // The key is deliberately not required to be static: Now.ID[key] has
  // definite Now.ID provenance even though duplicate/naming precision is lost.
  return isCanonicalNowIdNamespace(
    (expr as ESTree.MemberExpression).object as ESTree.Node,
    analysis,
    new Set(),
  );
}

export function isCanonicalNowInclude(node: unknown, analysis: ProvenanceQuery): boolean {
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return false;
  const callee =
    expr.type === "CallExpression" || expr.type === "NewExpression"
      ? (expr as ESTree.CallExpression).callee
      : expr;
  const chain = staticMemberChain(callee);
  if (!chain || chain[1] !== "include") return false;
  return isCanonicalNow(isNode(callee) ? callee : expr, analysis);
}

function semanticParent(
  ancestors: readonly ESTree.Node[],
  node: ESTree.Node,
): ESTree.Node | undefined {
  const inner = unwrapExpression(node);
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const candidate = ancestors[index]!;
    if (unwrapExpression(candidate) === inner) continue;
    return candidate;
  }
  return undefined;
}

function isPropertyValue(parent: ESTree.Node | undefined, node: ESTree.Node, key: string): boolean {
  if (!parent) return false;
  if (parent.type !== "Property") return false;
  const property = parent as unknown as ESTree.ObjectProperty;
  if (unwrapExpression(property.value) !== node && property.value !== node) return false;
  return propertyKeyName(property) === key;
}

function isIdPropertyAssignment(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  if (!parent || parent.type !== "AssignmentExpression") return false;
  const assign = parent as ESTree.AssignmentExpression;
  if (assign.operator !== "=" || (unwrapExpression(assign.right) !== node && assign.right !== node))
    return false;
  if (!isNode(assign.left) || assign.left.type !== "MemberExpression") return false;
  return staticPropertyName(assign.left) === "$id";
}

function isAliasInit(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  if (!parent) return false;
  if (parent.type === "VariableDeclarator") {
    const decl = parent as ESTree.VariableDeclarator;
    // Only a lexical identifier receives alias semantics. Destructuring and
    // member writes are real uses of the identity value.
    return (
      isNode(decl.id) &&
      decl.id.type === "Identifier" &&
      (unwrapExpression(decl.init) === node || decl.init === node)
    );
  }
  if (parent.type === "AssignmentExpression") {
    const assign = parent as ESTree.AssignmentExpression;
    const left = unwrapExpression(assign.left);
    return (
      isNode(left) &&
      left.type === "Identifier" &&
      assign.operator === "=" &&
      (unwrapExpression(assign.right) === node || assign.right === node)
    );
  }
  return false;
}

function isDeclarationId(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  if (!parent) return false;
  if (parent.type === "VariableDeclarator") {
    return (parent as ESTree.VariableDeclarator).id === node;
  }
  if (parent.type === "FunctionDeclaration" || parent.type === "ClassDeclaration") {
    return (parent as { id?: ESTree.Node }).id === node;
  }
  return false;
}

function isNonValuePropertyKey(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  if (!parent || parent.type !== "Property") return false;
  const property = parent as unknown as ESTree.ObjectProperty;
  return property.key === node && !property.shorthand && !property.computed;
}

const TYPE_ONLY_USE_PARENTS = new Set([
  "TSTypeQuery",
  "TSTypeReference",
  "TSQualifiedName",
  "TSTypeAnnotation",
]);

function isTypeOnlyUse(parent: ESTree.Node | undefined): boolean {
  return Boolean(parent && TYPE_ONLY_USE_PARENTS.has(parent.type));
}

function feedsId(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  return isPropertyValue(parent, node, "$id") || isIdPropertyAssignment(parent, node);
}

export function nowIdValue(node: ESTree.Node, analysis: ProvenanceQuery): NowIdFact | undefined {
  if (!isCanonicalNowId(node, analysis)) return undefined;
  const key = staticPropertyName(unwrapExpression(node));
  return key === null ? unknownNowId() : staticNowId(key);
}

/** True when this node is a canonical `Now.ID` lookup or a proven alias at this program point. */
export function isProvenNowIdValue(
  node: ESTree.Node,
  analysis: ProvenanceQuery,
  facts: ReadonlyMap<ESTree.Node, NowIdFact>,
): boolean {
  if (isCanonicalNowId(node, analysis)) return true;
  const inner = unwrapExpression(node);
  if (!isNode(inner)) return false;
  const fact = facts.get(node) ?? facts.get(inner);
  return fact?.kind === "static" || fact?.kind === "unknown";
}

/**
 * `Now.ID[...]` is a metadata identity. Report uses that do not feed `$id`.
 * Alias meaning is read at the use site from binding/object identity.
 */
export function findNowIdMisuses(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  facts: ReadonlyMap<ESTree.Node, NowIdFact>,
): NowIdMisuse[] {
  const findings: NowIdMisuse[] = [];
  const ancestors: ESTree.Node[] = [];

  walk(
    program,
    {
      MemberExpression(node) {
        const fact = facts.get(node);
        if (!fact) return;
        const parent = semanticParent(ancestors, node);
        if (isTypeOnlyUse(parent) || feedsId(parent, node) || isAliasInit(parent, node)) return;
        findings.push({ node, key: fact.kind === "static" ? fact.key : null });
      },
      Identifier(node) {
        const fact = facts.get(node);
        if (!fact) return;
        const parent = semanticParent(ancestors, node);
        if (
          isDeclarationId(parent, node) ||
          isNonValuePropertyKey(parent, node) ||
          isTypeOnlyUse(parent)
        )
          return;
        if (feedsId(parent, node) || isAliasInit(parent, node)) return;
        findings.push({ node, key: fact.kind === "static" ? fact.key : null });
      },
    },
    ancestors,
  );
  return findings;
}

/**
 * File-local duplicate static `Now.ID` keys used as `$id` at their use sites.
 */
export function findDuplicateFluentIds(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  facts: ReadonlyMap<ESTree.Node, NowIdFact>,
): DuplicateFluentId[] {
  const first = new Map<string, ESTree.Node>();
  const findings: DuplicateFluentId[] = [];
  const ancestors: ESTree.Node[] = [];

  const consider = (node: ESTree.Node): void => {
    const parent = semanticParent(ancestors, node);
    if (!feedsId(parent, node)) return;
    const fact = facts.get(node);
    if (!fact || fact.kind !== "static") return;
    const key = fact.key;
    const seen = first.get(key);
    if (!seen) {
      first.set(key, node);
      return;
    }
    findings.push({ node, key });
  };

  walk(
    program,
    {
      MemberExpression(node) {
        consider(node);
      },
      Identifier(node) {
        consider(node);
      },
    },
    ancestors,
  );
  return findings;
}
