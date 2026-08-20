import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  isNode,
  nowIdKey,
  propertyKeyName,
  staticMemberChain,
  walk,
} from "../utils/ast.js";
import { analyzePathBindings } from "./path-state.js";
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
const STATIC_NOW_IDS = new Map<string, StaticNowIdFact>();

function staticNowId(key: string): StaticNowIdFact {
  const existing = STATIC_NOW_IDS.get(key);
  if (existing) return existing;
  const fact: StaticNowIdFact = Object.freeze({ kind: "static", key });
  STATIC_NOW_IDS.set(key, fact);
  return fact;
}

function unknownNowId(): UnknownNowIdFact {
  return UNKNOWN_NOW_ID;
}

export function mergeNowIdFacts(left: NowIdFact, right: NowIdFact): NowIdFact {
  if (left === right) return left;
  if (left?.kind === "static" && right?.kind === "static" && left.key === right.key) {
    return staticNowId(left.key);
  }
  return unknownNowId();
}

interface NowIdData {
  nowIdKey: NowIdFact;
}

function unwrapExpr(node: unknown): ESTree.Node | null {
  let current = node;
  while (isNode(current)) {
    const type = current.type;
    if (
      type === "TSAsExpression" ||
      type === "TSSatisfiesExpression" ||
      type === "TSTypeAssertion" ||
      type === "TSNonNullExpression" ||
      type === "ParenthesizedExpression"
    ) {
      current = (current as { expression?: unknown }).expression;
      continue;
    }
    return current;
  }
  return null;
}

function nowRootIdentifier(node: ESTree.Node): ESTree.Node | null {
  let current: unknown = unwrapExpr(node);
  while (isNode(current) && current.type === "MemberExpression") {
    current = unwrapExpr((current as ESTree.MemberExpression).object);
  }
  return isNode(current) && getName(current) ? current : null;
}

function staticChain(node: unknown): string[] | null {
  const parts: string[] = [];
  let current: unknown = unwrapExpr(node);
  while (isNode(current) && current.type === "MemberExpression") {
    const member = current as ESTree.MemberExpression;
    const property = member.computed
      ? (member.property.type === "Literal" && typeof (member.property as { value?: unknown }).value === "string"
          ? (member.property as { value: string }).value
          : null)
      : getName(member.property);
    if (!property) return null;
    parts.unshift(property);
    current = unwrapExpr(member.object);
  }
  const root = getName(current);
  if (!root) return null;
  parts.unshift(root);
  return parts;
}

function isNowIdLookup(node: ESTree.Node): boolean {
  const expr = unwrapExpr(node);
  if (!isNode(expr) || expr.type !== "MemberExpression") return false;
  const object = unwrapExpr((expr as ESTree.MemberExpression).object);
  const chain = staticChain(object);
  // The key is deliberately not required to be static: Now.ID[key] has
  // definite Now.ID provenance even though duplicate/naming precision is lost.
  return Boolean(chain && chain.length === 2 && chain[0] === "Now" && chain[1] === "ID");
}

function canonicalAlias(
  root: ESTree.Node,
  analysis: ProvenanceQuery,
  seen: Set<number>,
): boolean {
  if (analysis.isPlatformGlobal(root)) return true;
  const name = getName(root);
  if (!name) return false;
  const binding = analysis.bindings.tree.resolve(name, root);
  if (!binding || seen.has(binding.id) || binding.kind !== "const") return false;
  if (binding.node.type !== "VariableDeclarator") return false;
  const declaration = binding.node as ESTree.VariableDeclarator;
  if (!isNode(declaration.id) || declaration.id.type !== "Identifier" || !isNode(declaration.init)) return false;
  seen.add(binding.id);
  const initRoot = nowRootIdentifier(declaration.init);
  return Boolean(initRoot && canonicalAlias(initRoot, analysis, seen));
}

/** True when `Now` is the platform global or a proven immutable alias. */
export function isCanonicalNow(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
  const root = nowRootIdentifier(node);
  return Boolean(root && canonicalAlias(root, analysis, new Set()));
}

export function isCanonicalNowId(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
  const expr = unwrapExpr(node) ?? node;
  return isNowIdLookup(expr) && isCanonicalNow(expr, analysis);
}

export function isCanonicalNowInclude(node: unknown, analysis: ProvenanceQuery): boolean {
  const expr = unwrapExpr(node);
  if (!expr) return false;
  const callee =
    expr.type === "CallExpression" || expr.type === "NewExpression"
      ? (expr as ESTree.CallExpression).callee
      : expr;
  const chain = staticChain(callee);
  if (!chain || chain[1] !== "include") return false;
  return isCanonicalNow(isNode(callee) ? callee : expr, analysis);
}

function parentOf(ancestors: readonly ESTree.Node[]): ESTree.Node | undefined {
  return ancestors.length >= 2 ? ancestors[ancestors.length - 2] : undefined;
}

function isPropertyValue(parent: ESTree.Node | undefined, node: ESTree.Node, key: string): boolean {
  if (!parent) return false;
  if (parent.type !== "Property") return false;
  const property = parent as unknown as ESTree.ObjectProperty;
  if (unwrapExpr(property.value) !== node && property.value !== node) return false;
  return propertyKeyName(property) === key;
}

function isIdPropertyAssignment(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  if (!parent || parent.type !== "AssignmentExpression") return false;
  const assign = parent as ESTree.AssignmentExpression;
  if (unwrapExpr(assign.right) !== node && assign.right !== node) return false;
  if (!isNode(assign.left) || assign.left.type !== "MemberExpression") return false;
  return staticMemberName(assign.left) === "$id";
}

function staticMemberName(node: ESTree.Node): string | null {
  if (node.type !== "MemberExpression") return null;
  const member = node as ESTree.MemberExpression;
  if (member.computed) {
    const rec = member.property as { type?: string; value?: unknown };
    return rec.type === "Literal" && typeof rec.value === "string" ? rec.value : null;
  }
  return getName(member.property);
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
      (unwrapExpr(decl.init) === node || decl.init === node)
    );
  }
  if (parent.type === "AssignmentExpression") {
    const assign = parent as ESTree.AssignmentExpression;
    const left = unwrapExpr(assign.left);
    return (
      isNode(left) &&
      left.type === "Identifier" &&
      (unwrapExpr(assign.right) === node || assign.right === node)
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

function feedsId(parent: ESTree.Node | undefined, node: ESTree.Node): boolean {
  return isPropertyValue(parent, node, "$id") || isIdPropertyAssignment(parent, node);
}

export function nowIdValue(node: ESTree.Node, analysis: ProvenanceQuery): NowIdFact | undefined {
  if (!isCanonicalNowId(node, analysis)) return undefined;
  const key = nowIdKey(unwrapExpr(node) ?? node);
  return key === null ? unknownNowId() : staticNowId(key);
}

function isUnknownNowId(value: NowIdFact | undefined): value is UnknownNowIdFact {
  return Boolean(value && typeof value === "object" && value.kind === "unknown");
}

/** True when this node is a canonical `Now.ID` lookup or a proven alias at this program point. */
export function isProvenNowIdValue(
  node: ESTree.Node,
  analysis: ProvenanceQuery,
  facts: ReadonlyMap<ESTree.Node, NowIdFact>,
): boolean {
  if (isCanonicalNowId(node, analysis)) return true;
  const inner = unwrapExpr(node) ?? node;
  const fact = facts.get(node) ?? facts.get(inner);
  return fact?.kind === "static" || fact?.kind === "unknown";
}

function collectNowIdFacts(program: ESTree.Node, analysis: ProvenanceQuery): Map<ESTree.Node, NowIdFact> {
  const facts = new Map<ESTree.Node, NowIdFact>();
  analyzePathBindings<NowIdData>({
    program,
    analysis,
    kinds: [],
    emptyData: () => ({ nowIdKey: null }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({ nowIdKey: mergeNowIdFacts(left.nowIdKey, right.nowIdKey) }),
    onCall() {},
    onValue(node) {
      const key = nowIdValue(node, analysis);
      if (key === undefined) return undefined;
      return { nowIdKey: key };
    },
    onRef({ node, rec }) {
      if (!rec || rec.data.nowIdKey == null) return;
      facts.set(node, rec.data.nowIdKey);
    },
  });
  return facts;
}

/**
 * `Now.ID[...]` is a metadata identity. Report uses that do not feed `$id`.
 * Alias meaning is read at the use site from binding/object identity.
 */
export function findNowIdMisuses(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  facts: ReadonlyMap<ESTree.Node, NowIdFact> = collectNowIdFacts(program, analysis),
): NowIdMisuse[] {
  const findings: NowIdMisuse[] = [];
  const ancestors: ESTree.Node[] = [];

  walk(
    program,
    {
      MemberExpression(node) {
        const fact = facts.get(node);
        if (!fact) return;
        const parent = parentOf(ancestors);
        if (feedsId(parent, node) || isAliasInit(parent, node)) return;
        findings.push({ node, key: fact.kind === "static" ? fact.key : null });
      },
      Identifier(node) {
        const fact = facts.get(node);
        if (!fact) return;
        const parent = parentOf(ancestors);
        if (isDeclarationId(parent, node) || isNonValuePropertyKey(parent, node)) return;
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
  facts: ReadonlyMap<ESTree.Node, NowIdFact> = collectNowIdFacts(program, analysis),
): DuplicateFluentId[] {
  const first = new Map<string, ESTree.Node>();
  const findings: DuplicateFluentId[] = [];
  const ancestors: ESTree.Node[] = [];

  const consider = (node: ESTree.Node): void => {
    const parent = parentOf(ancestors);
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
