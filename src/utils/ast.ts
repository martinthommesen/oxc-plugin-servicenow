import type { ESTree } from "@oxlint/plugins";

type AnyNode = ESTree.Node | Record<string, unknown>;

export function isNode(value: unknown): value is ESTree.Node {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { type?: unknown }).type === "string",
  );
}

export function getName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const rec = node as { type?: string; name?: unknown };
  if (rec.type === "Identifier" && typeof rec.name === "string") return rec.name;
  if (rec.type === "PrivateIdentifier" && typeof rec.name === "string") return rec.name;
  return null;
}

export function getStringValue(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const rec = node as {
    type?: string;
    value?: unknown;
    raw?: string;
    quasis?: Array<{ value?: { cooked?: string | null; raw?: string } }>;
    expressions?: unknown[];
  };

  if (rec.type === "Literal" || rec.type === "StringLiteral") {
    return typeof rec.value === "string" ? rec.value : null;
  }

  if (
    rec.type === "TemplateLiteral" &&
    Array.isArray(rec.expressions) &&
    rec.expressions.length === 0 &&
    Array.isArray(rec.quasis) &&
    rec.quasis[0]
  ) {
    return rec.quasis[0].value?.cooked ?? rec.quasis[0].value?.raw ?? null;
  }

  return null;
}

export function isIdentifier(node: unknown, name: string): boolean {
  return getName(node) === name;
}

export function memberName(node: unknown): { object: string; property: string } | null {
  if (!isNode(node) || node.type !== "MemberExpression") return null;
  const member = node as unknown as ESTree.MemberExpression;
  if (member.computed && member.property.type !== "Literal") return null;
  const object = getName(member.object);
  const property = member.computed ? getStringValue(member.property) : getName(member.property);
  if (!object || !property) return null;
  return { object, property };
}

export function staticMemberChain(node: unknown): string[] | null {
  const parts: string[] = [];
  let current: unknown = node;

  while (current && isNode(current) && current.type === "MemberExpression") {
    const member = current as unknown as ESTree.MemberExpression;
    const prop = member.computed ? getStringValue(member.property) : getName(member.property);
    if (!prop) return null;
    parts.unshift(prop);
    current = member.object;
  }

  const root = getName(current);
  if (!root) return null;
  parts.unshift(root);
  return parts;
}

export function calleeName(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    const expr = node as unknown as ESTree.CallExpression | ESTree.NewExpression;
    return getName(expr.callee) ?? staticMemberChain(expr.callee)?.join(".") ?? null;
  }
  return getName(node);
}

export function propertyName(node: unknown): string | null {
  if (!isNode(node) || node.type !== "MemberExpression") return null;
  const member = node as unknown as ESTree.MemberExpression;
  return member.computed ? getStringValue(member.property) : getName(member.property);
}

export function isCallTo(
  node: unknown,
  object: string,
  method: string,
): node is ESTree.CallExpression {
  if (!isNode(node) || node.type !== "CallExpression") return false;
  const member = memberName((node as unknown as ESTree.CallExpression).callee);
  return member?.object === object && member.property === method;
}

export function isNewNamed(node: unknown, name: string): node is ESTree.NewExpression {
  if (!isNode(node) || node.type !== "NewExpression") return false;
  return getName((node as unknown as ESTree.NewExpression).callee) === name;
}

export function propertyKeyName(property: ESTree.ObjectProperty): string | null {
  return property.computed
    ? getStringValue(property.key)
    : (getName(property.key) ?? getStringValue(property.key));
}

export function objectProperty(
  object: unknown,
  key: string,
): ESTree.ObjectProperty | null {
  if (!isNode(object) || object.type !== "ObjectExpression") return null;
  const expr = object as unknown as ESTree.ObjectExpression;
  for (const prop of expr.properties) {
    if (!prop || (prop as { type?: string }).type !== "Property") continue;
    const property = prop as unknown as ESTree.ObjectProperty;
    const name = propertyKeyName(property);
    if (name === key) return property;
  }
  return null;
}

export function objectPropertyValue(object: unknown, key: string): ESTree.Node | null {
  const prop = objectProperty(object, key);
  return (prop?.value as ESTree.Node | undefined) ?? null;
}

export function isNowIncludeCall(node: unknown): boolean {
  const chain = staticMemberChain(
    isNode(node) && (node.type === "CallExpression" || node.type === "NewExpression")
      ? (node as unknown as ESTree.CallExpression).callee
      : node,
  );
  return Boolean(chain && chain[0] === "Now" && chain[1] === "include");
}

export function isNowIdAccess(node: unknown): boolean {
  const chain = staticMemberChain(node);
  if (chain && chain[0] === "Now" && chain[1] === "ID") return true;

  if (isNode(node) && node.type === "MemberExpression") {
    const member = node as unknown as ESTree.MemberExpression;
    const objectChain = staticMemberChain(member.object);
    if (objectChain && objectChain[0] === "Now" && objectChain[1] === "ID") return true;
  }

  return false;
}

export function nowIdKey(node: unknown): string | null {
  if (!isNode(node) || node.type !== "MemberExpression") return null;
  const member = node as unknown as ESTree.MemberExpression;
  const objectChain = staticMemberChain(member.object);
  if (!objectChain || objectChain[0] !== "Now" || objectChain[1] !== "ID") return null;
  if (member.computed) return getStringValue(member.property);
  return getName(member.property);
}

export function declaredName(node: unknown): string | null {
  if (!isNode(node) || node.type !== "VariableDeclarator") return null;
  return getName((node as unknown as ESTree.VariableDeclarator).id);
}

export function isExpressionStatementCall(parent: unknown): boolean {
  return isNode(parent) && parent.type === "ExpressionStatement";
}

export type CommentLike = {
  type?: string;
  value: string;
  start?: number;
  end?: number;
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
};

export function commentText(comment: CommentLike): string {
  return comment.value.trim();
}

/** Extract `//` and `/*` comment bodies when `sourceCode.getAllComments` is missing. */
export function fallbackComments(text: string): Array<{ value: string; start: number; end: number }> {
  const out: Array<{ value: string; start: number; end: number }> = [];
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[0];
    const value = raw.startsWith("//") ? raw.slice(2) : raw.slice(2, -2);
    out.push({ value, start: match.index, end: match.index + raw.length });
  }
  return out;
}

/** Keys that are not syntactic children. ESLint AST nodes also store `parent`. */
export const WALK_SKIP_KEYS = new Set([
  "type",
  "loc",
  "range",
  "span",
  "start",
  "end",
  "parent",
  "comments",
  "tokens",
  "leadingComments",
  "trailingComments",
  "innerComments",
]);

/**
 * Depth-first walk. `ancestors` is mutated so `getAncestors()` can read the
 * parent chain while a visitor is running (current node is last).
 *
 * Host ASTs may attach `parent` and comment/token lists. Those keys are
 * skipped, and already-visited nodes are not entered again.
 */
export function walk(
  node: AnyNode,
  visitors: Record<string, ((node: ESTree.Node) => void) | undefined>,
  ancestors: ESTree.Node[] = [],
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (!isNode(node)) return;
  if (seen.has(node)) return;
  seen.add(node);
  const typed = node as ESTree.Node;
  ancestors.push(typed);
  visitors[typed.type]?.(typed);

  for (const key of Object.keys(node)) {
    if (WALK_SKIP_KEYS.has(key)) continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) walk(child, visitors, ancestors, seen);
      }
    } else if (isNode(value)) {
      walk(value, visitors, ancestors, seen);
    }
  }

  visitors[`${typed.type}:exit`]?.(typed);
  ancestors.pop();
}
