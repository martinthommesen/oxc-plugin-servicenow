import type { ESTree } from "@oxlint/plugins";

type AnyNode = ESTree.Node | Record<string, unknown>;
export function isNode(value: unknown): value is ESTree.Node {
  return Boolean(
    value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string",
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

/** Resolve a bounded, side-effect-free string expression. */
export function getStaticStringValue(node: unknown, depth = 0): string | null {
  if (depth > 32) return null;
  const inner = unwrapExpression(node);
  const direct = getStringValue(inner);
  if (direct !== null) return direct;
  if (!isNode(inner)) return null;
  if (inner.type === "BinaryExpression" && (inner as ESTree.BinaryExpression).operator === "+") {
    const binary = inner as ESTree.BinaryExpression;
    const left = getStaticStringValue(binary.left, depth + 1);
    const right = getStaticStringValue(binary.right, depth + 1);
    return left === null || right === null ? null : left + right;
  }
  if (inner.type === "TemplateLiteral") {
    const template = inner as ESTree.TemplateLiteral;
    let value = "";
    for (let index = 0; index < template.quasis.length; index += 1) {
      const quasi = template.quasis[index];
      if (!quasi) return null;
      value += quasi.value.cooked ?? quasi.value.raw;
      const expression = template.expressions[index];
      if (!expression) continue;
      const resolved = getStaticStringValue(expression, depth + 1);
      if (resolved === null) return null;
      value += resolved;
    }
    return value;
  }
  return null;
}

export function isIdentifier(node: unknown, name: string): boolean {
  return getName(node) === name;
}

/**
 * Strip grouping and TypeScript wrappers so identity looks at the inner value.
 */
export function unwrapExpression(node: unknown): unknown {
  let current = node;
  while (isNode(current)) {
    switch (current.type) {
      case "ParenthesizedExpression":
      case "ChainExpression":
      case "TSAsExpression":
      case "TSTypeAssertion":
      case "TSNonNullExpression":
      case "TSSatisfiesExpression":
        current = (current as { expression?: unknown }).expression;
        continue;
      default:
        return current;
    }
  }
  return current;
}

const TYPE_ONLY_ANCESTORS = new Set([
  "JSDocNonNullableType",
  "JSDocNullableType",
  "JSDocUnknownType",
  "TSAnyKeyword",
  "TSArrayType",
  "TSBigIntKeyword",
  "TSBooleanKeyword",
  "TSCallSignatureDeclaration",
  "TSClassImplements",
  "TSConditionalType",
  "TSConstructSignatureDeclaration",
  "TSConstructorType",
  "TSDeclareFunction",
  "TSExpressionWithTypeArguments",
  "TSFunctionType",
  "TSImportType",
  "TSIndexSignature",
  "TSIndexedAccessType",
  "TSInferType",
  "TSInterfaceDeclaration",
  "TSInterfaceHeritage",
  "TSIntersectionType",
  "TSIntrinsicKeyword",
  "TSLiteralType",
  "TSMappedType",
  "TSMethodSignature",
  "TSNamedTupleMember",
  "TSNeverKeyword",
  "TSNullKeyword",
  "TSNumberKeyword",
  "TSObjectKeyword",
  "TSOptionalType",
  "TSParenthesizedType",
  "TSPropertySignature",
  "TSQualifiedName",
  "TSRestType",
  "TSStringKeyword",
  "TSSymbolKeyword",
  "TSTemplateLiteralType",
  "TSThisType",
  "TSTupleType",
  "TSTypeAliasDeclaration",
  "TSTypeAnnotation",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypeParameter",
  "TSTypeParameterDeclaration",
  "TSTypeParameterInstantiation",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUndefinedKeyword",
  "TSUnionType",
  "TSUnknownKeyword",
  "TSVoidKeyword",
]);

function hasTypeOnlyAncestor(ancestors: readonly ESTree.Node[]): boolean {
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    if (TYPE_ONLY_ANCESTORS.has(ancestors[index]!.type)) return true;
  }
  return false;
}

/**
 * True when an Identifier is a value read, not a declaration, label, or static key.
 */
export function isValueReference(node: ESTree.Node, ancestors: readonly ESTree.Node[]): boolean {
  if (hasTypeOnlyAncestor(ancestors)) return false;
  const parent = ancestors.length >= 2 ? ancestors[ancestors.length - 2] : undefined;
  if (!parent) return true;
  switch (parent.type) {
    case "VariableDeclarator":
      return (parent as ESTree.VariableDeclarator).id !== node;
    case "MemberExpression": {
      const member = parent as ESTree.MemberExpression;
      return member.property !== node || member.computed === true;
    }
    case "Property":
    case "PropertyDefinition":
    case "MethodDefinition": {
      const prop = parent as { key?: unknown; computed?: boolean; shorthand?: boolean };
      return prop.key !== node || prop.computed === true || prop.shorthand === true;
    }
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ClassDeclaration":
    case "ClassExpression":
      return (parent as { id?: unknown }).id !== node;
    case "MetaProperty":
    case "ImportSpecifier":
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
    case "ExportSpecifier":
      return false;
    case "LabeledStatement":
      return (parent as ESTree.LabeledStatement).label !== node;
    case "BreakStatement":
    case "ContinueStatement":
      return (parent as { label?: unknown }).label !== node;
    default:
      return true;
  }
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
  let current: unknown = unwrapExpression(node);

  while (current && isNode(current) && current.type === "MemberExpression") {
    const member = current as unknown as ESTree.MemberExpression;
    const prop = member.computed ? getStringValue(member.property) : getName(member.property);
    if (!prop) return null;
    parts.unshift(prop);
    current = unwrapExpression(member.object);
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

export function objectProperty(object: unknown, key: string): ESTree.ObjectProperty | null {
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

/** Structural `Now.include()` shape. Use `isCanonicalNowInclude` for SDK proof. */
export function isNowIncludeCall(node: unknown): boolean {
  const chain = staticMemberChain(
    isNode(node) && (node.type === "CallExpression" || node.type === "NewExpression")
      ? (node as unknown as ESTree.CallExpression).callee
      : node,
  );
  return Boolean(chain && chain[0] === "Now" && chain[1] === "include");
}

/** Structural `Now.ID` shape. Use `isCanonicalNowId` for SDK proof. */
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

/** Extract comment bodies when the host does not expose `getAllComments()`. */
export function fallbackComments(
  text: string,
): Array<{ value: string; start: number; end: number }> {
  const comments: Array<{ value: string; start: number; end: number }> = [];
  let index = 0;
  let allowBlock = true;

  while (index < text.length) {
    if (text.charCodeAt(index) !== 47) {
      index += 1;
      continue;
    }

    const next = text.charCodeAt(index + 1);
    if (next === 47) {
      const start = index;
      index += 2;
      while (index < text.length && text.charCodeAt(index) !== 10) index += 1;
      comments.push({ value: text.slice(start + 2, index), start, end: index });
      continue;
    }

    if (next === 42 && allowBlock) {
      const start = index;
      const close = text.indexOf("*/", index + 2);
      if (close === -1) {
        allowBlock = false;
        index += 1;
        continue;
      }
      index = close + 2;
      comments.push({ value: text.slice(start + 2, close), start, end: index });
      continue;
    }

    index += 1;
  }

  return comments;
}

/** Stable source offset across ESTree, ESLint, and Oxlint node adapters. */
export function nodeStart(node: ESTree.Node): number {
  const compatible = node as unknown as {
    start?: number;
    range?: readonly number[];
    span?: { start?: number };
  };
  return compatible.start ?? compatible.range?.[0] ?? compatible.span?.start ?? -1;
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
  ancestorIndex?: WeakMap<object, readonly ESTree.Node[]>,
): void {
  if (!isNode(node)) return;
  const stack: Array<{ node: ESTree.Node; exit: boolean }> = [
    { node: node as ESTree.Node, exit: false },
  ];
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.exit) {
      visitors[`${frame.node.type}:exit`]?.(frame.node);
      ancestors.pop();
      continue;
    }
    if (seen.has(frame.node)) continue;
    seen.add(frame.node);
    ancestorIndex?.set(frame.node, ancestors.slice());
    ancestors.push(frame.node);
    visitors[frame.node.type]?.(frame.node);
    stack.push({ node: frame.node, exit: true });

    const children: ESTree.Node[] = [];
    for (const key of Object.keys(frame.node)) {
      if (WALK_SKIP_KEYS.has(key)) continue;
      const value = (frame.node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) children.push(child);
      } else if (isNode(value)) {
        children.push(value);
      }
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index]!, exit: false });
    }
  }
}
