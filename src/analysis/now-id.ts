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

export type NowIdFact = string | "unknown" | null;

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
  let current: unknown = node;
  while (isNode(current) && current.type === "MemberExpression") {
    current = (current as ESTree.MemberExpression).object;
  }
  if (isNode(current) && getName(current) === "Now") return current;
  return null;
}

function isNowIdLookup(node: ESTree.Node): boolean {
  if (node.type !== "MemberExpression") return false;
  const objectChain = staticMemberChain((node as ESTree.MemberExpression).object);
  return Boolean(objectChain && objectChain[0] === "Now" && objectChain[1] === "ID");
}

/** True when `Now` is the unresolved platform global, not a local binding. */
export function isCanonicalNow(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
  const root = nowRootIdentifier(node);
  return Boolean(root && analysis.isPlatformGlobal(root));
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
  const chain = staticMemberChain(callee);
  if (!chain || chain[0] !== "Now" || chain[1] !== "include") return false;
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
    return unwrapExpr(decl.init) === node || decl.init === node;
  }
  if (parent.type === "AssignmentExpression") {
    const assign = parent as ESTree.AssignmentExpression;
    return unwrapExpr(assign.right) === node || assign.right === node;
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
  const key = nowIdKey(node);
  return key ?? "unknown";
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
  return fact != null && fact !== "unknown";
}

function collectNowIdFacts(program: ESTree.Node, analysis: ProvenanceQuery): Map<ESTree.Node, NowIdFact> {
  const facts = new Map<ESTree.Node, NowIdFact>();
  analyzePathBindings<NowIdData>({
    program,
    analysis,
    kinds: [],
    emptyData: () => ({ nowIdKey: null }),
    cloneData: (data) => ({ ...data }),
    mergeData: (left, right) => ({
      nowIdKey: left.nowIdKey === right.nowIdKey ? left.nowIdKey : "unknown",
    }),
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
        const key = facts.get(node);
        if (key === undefined || key === "unknown") return;
        const parent = parentOf(ancestors);
        if (feedsId(parent, node) || isAliasInit(parent, node)) return;
        findings.push({ node, key });
      },
      Identifier(node) {
        const key = facts.get(node);
        if (key === undefined || key === "unknown") return;
        const parent = parentOf(ancestors);
        if (isDeclarationId(parent, node) || isNonValuePropertyKey(parent, node)) return;
        if (feedsId(parent, node) || isAliasInit(parent, node)) return;
        findings.push({ node, key: key === null ? null : key });
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
    const key = facts.get(node);
    if (!key || key === "unknown") return;
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
