import type { ESTree } from "@oxlint/plugins";
import {
  getName,
  isNode,
  nowIdKey,
  propertyKeyName,
  staticMemberChain,
  walk,
} from "../utils/ast.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface NowIdMisuse {
  node: ESTree.Node;
  key: string | null;
}

export interface DuplicateFluentId {
  node: ESTree.Node;
  key: string;
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

function isPlatformNowId(node: ESTree.Node, analysis: ProvenanceQuery): boolean {
  if (!isNowIdLookup(node)) return false;
  const root = nowRootIdentifier(node);
  return Boolean(root && analysis.isPlatformGlobal(root));
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

function isAliasInit(parent: ESTree.Node | undefined, node: ESTree.Node): string | null {
  if (!parent) return null;
  if (parent.type === "VariableDeclarator") {
    const decl = parent as ESTree.VariableDeclarator;
    if (unwrapExpr(decl.init) === node || decl.init === node) return getName(decl.id);
  }
  if (parent.type === "AssignmentExpression") {
    const assign = parent as ESTree.AssignmentExpression;
    if ((unwrapExpr(assign.right) === node || assign.right === node) && getName(assign.left)) {
      return getName(assign.left);
    }
  }
  return null;
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

function feedsId(
  parent: ESTree.Node | undefined,
  node: ESTree.Node,
  aliases: Map<string, string | null>,
): boolean {
  if (isPropertyValue(parent, node, "$id") || isIdPropertyAssignment(parent, node)) return true;
  const alias = isAliasInit(parent, node);
  if (alias && aliases.has(alias)) return true;
  return false;
}

function collectAliases(program: ESTree.Node, analysis: ProvenanceQuery): Map<string, string | null> {
  const aliases = new Map<string, string | null>();
  const ancestors: ESTree.Node[] = [];
  walk(
    program,
    {
      VariableDeclarator(node) {
        const decl = node as ESTree.VariableDeclarator;
        const name = getName(decl.id);
        const init = unwrapExpr(decl.init);
        if (!name || !init) return;
        if (isPlatformNowId(init, analysis)) {
          aliases.set(name, nowIdKey(init));
          return;
        }
        const source = getName(init);
        if (source && aliases.has(source)) aliases.set(name, aliases.get(source) ?? null);
      },
      AssignmentExpression(node) {
        const assign = node as ESTree.AssignmentExpression;
        const name = getName(assign.left);
        const right = unwrapExpr(assign.right);
        if (!name || !right) return;
        if (isPlatformNowId(right, analysis)) {
          aliases.set(name, nowIdKey(right));
          return;
        }
        const source = getName(right);
        if (source && aliases.has(source)) {
          aliases.set(name, aliases.get(source) ?? null);
          return;
        }
        if (aliases.has(name)) aliases.delete(name);
      },
    },
    ancestors,
  );
  return aliases;
}

function resolveIdKey(
  node: ESTree.Node,
  analysis: ProvenanceQuery,
  aliases: Map<string, string | null>,
): string | null {
  const expr = unwrapExpr(node) ?? node;
  if (isPlatformNowId(expr, analysis)) return nowIdKey(expr);
  const name = getName(expr);
  if (name && aliases.has(name)) return aliases.get(name) ?? null;
  return null;
}

/**
 * `Now.ID[...]` is a metadata identity. Report uses that do not feed `$id`.
 */
export function findNowIdMisuses(program: ESTree.Node, analysis: ProvenanceQuery): NowIdMisuse[] {
  const aliases = collectAliases(program, analysis);
  const findings: NowIdMisuse[] = [];
  const ancestors: ESTree.Node[] = [];

  walk(
    program,
    {
      MemberExpression(node) {
        if (!isPlatformNowId(node, analysis)) return;
        const parent = parentOf(ancestors);
        if (feedsId(parent, node, aliases)) return;
        findings.push({ node, key: nowIdKey(node) });
      },
      Identifier(node) {
        const name = getName(node);
        if (!name || !aliases.has(name)) return;
        const parent = parentOf(ancestors);
        if (isDeclarationId(parent, node) || isNonValuePropertyKey(parent, node)) return;
        if (feedsId(parent, node, aliases)) return;
        findings.push({ node, key: aliases.get(name) ?? null });
      },
    },
    ancestors,
  );
  return findings;
}

/**
 * File-local duplicate static `Now.ID` keys used as `$id`.
 */
export function findDuplicateFluentIds(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
): DuplicateFluentId[] {
  const aliases = collectAliases(program, analysis);
  const first = new Map<string, ESTree.Node>();
  const findings: DuplicateFluentId[] = [];
  const ancestors: ESTree.Node[] = [];

  const consider = (node: ESTree.Node): void => {
    const parent = parentOf(ancestors);
    if (!isPropertyValue(parent, node, "$id") && !isIdPropertyAssignment(parent, node)) return;
    const key = resolveIdKey(node, analysis, aliases);
    if (!key) return;
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
