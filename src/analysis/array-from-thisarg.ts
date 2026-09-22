import type { Context, ESTree } from "@oxlint/plugins";
import { getStringValue, isNode, unwrapExpression } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import type { EmptyArrayBindingQuery } from "./empty-array-bindings.js";
import { isDefinitelyNullishValue, resolveDominatingConstValue } from "./members.js";
import { visitChildren } from "../utils/ast.js";
import { getAncestors } from "./provenance.js";
import { isFunctionLike, type ImmediateFunction } from "./bindings.js";

/**
 * Primitive this arguments reached `ensureScriptable()` before Australia and
 * therefore threw instead of following ordinary strict/sloppy call semantics.
 * Keep the proof to direct or dominating static primitives.
 */
export function isDefinitelyPrimitiveThisArgument(node: unknown, bindings: FileBindings): boolean {
  if (isDefinitelyNullishValue(node, bindings)) return true;
  const value = resolveDominatingConstValue(node, bindings);
  if (!value) return false;
  if (value.type === "TemplateLiteral") return value.expressions.length === 0;
  if (value.type !== "Literal") return false;
  const literal = value as unknown as { regex?: unknown; value?: unknown; bigint?: unknown };
  if (literal.regex !== undefined) return false;
  const kind = typeof literal.value;
  return (
    kind === "string" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "bigint" ||
    typeof literal.bigint === "string"
  );
}

export function isDefinitelyEmptyMapperSource(
  node: unknown,
  bindings: FileBindings,
  bindingReferences: EmptyArrayBindingQuery,
): boolean {
  const direct = unwrapExpression(node);
  if (isNode(direct) && direct.type === "ArrayExpression") return direct.elements.length === 0;
  const value = resolveDominatingConstValue(node, bindings);
  if (!value) return false;
  if (value.type === "ArrayExpression") {
    if (value.elements.length > 0 || !isNode(direct) || direct.type !== "Identifier") {
      return false;
    }
    const binding = bindings.resolve(direct.name, direct);
    if (binding?.kind !== "const" || binding.node.type !== "VariableDeclarator") return false;
    const declaration = binding.node as ESTree.VariableDeclarator;
    const initializer = unwrapExpression(declaration.init);
    if (!isNode(initializer) || initializer !== value) return false;
    // A const binding stabilizes only the array identity. Suppress an empty
    // initializer only while every reference that could precede this call is
    // a proven non-mutating read.
    return bindingReferences.isUnchangedThrough(binding, direct);
  }
  if (value.type === "Literal") return (value as { value?: unknown }).value === "";
  if (value.type !== "TemplateLiteral" || value.expressions.length > 0) return false;
  const quasi = value.quasis[0];
  return quasi !== undefined && (quasi.value.cooked ?? quasi.value.raw) === "";
}

function bodyHasUseStrictDirective(body: unknown): boolean {
  if (!isNode(body) || (body.type !== "BlockStatement" && body.type !== "Program")) return false;
  for (const statement of body.body) {
    if (statement.type !== "ExpressionStatement") return false;
    const expression = (statement as ESTree.ExpressionStatement).expression;
    const directive = (statement as { directive?: unknown }).directive;
    // Only plain string literals form a directive prologue. A template is an
    // ordinary expression and ends the prologue.
    const value = expression.type === "TemplateLiteral" ? null : getStringValue(expression);
    if (directive === "use strict" || value === "use strict") return true;
    if (value === null) return false;
  }
  return false;
}

/**
 * Prove sloppy function code from syntax. Parser sourceType is deliberately
 * ignored: classic ServiceNow records are scripts even when a lint host parses
 * their extracted source as a module. Explicit directives and class strictness
 * remain authoritative.
 */
export function isDefinitelySloppyMapper(context: Context, mapper: ImmediateFunction): boolean {
  if (bodyHasUseStrictDirective(mapper.body)) return false;
  const ancestors = getAncestors(context, mapper as ESTree.Node);
  if (!ancestors.some((ancestor) => ancestor.type === "Program")) return false;
  for (const ancestor of ancestors) {
    if (ancestor.type === "ClassDeclaration" || ancestor.type === "ClassExpression") return false;
    if (ancestor.type === "Program" && bodyHasUseStrictDirective(ancestor)) return false;
    if (isFunctionLike(ancestor) && bodyHasUseStrictDirective(ancestor.body)) return false;
  }
  return true;
}

function nestedArrowCanExposeThis(
  arrow: ImmediateFunction,
  parents: WeakMap<ESTree.Node, ESTree.Node>,
): boolean {
  let child = arrow as ESTree.Node;
  let parent = parents.get(child);
  while (parent) {
    switch (parent.type) {
      case "ReturnStatement":
      case "ThrowStatement":
        return true;
      case "YieldExpression":
        return !(parent as ESTree.YieldExpression).delegate;
      case "CallExpression":
        return (parent as ESTree.CallExpression).callee === child;
      case "TaggedTemplateExpression":
        return (parent as unknown as { tag?: unknown }).tag === child;
      case "AssignmentExpression": {
        const assignment = parent as ESTree.AssignmentExpression;
        if (assignment.right !== child) return false;
        break;
      }
      case "Property":
        if ((parent as ESTree.ObjectProperty).value !== child) return false;
        break;
      case "ArrayExpression":
      case "AwaitExpression":
      case "ChainExpression":
      case "ParenthesizedExpression":
      case "TSAsExpression":
      case "TSTypeAssertion":
      case "TSNonNullExpression":
      case "TSSatisfiesExpression":
        break;
      case "ConditionalExpression":
        if ((parent as ESTree.ConditionalExpression).test === child) return false;
        break;
      case "LogicalExpression": {
        const logical = parent as ESTree.LogicalExpression;
        if (logical.left === child && logical.operator === "&&") return false;
        break;
      }
      case "SequenceExpression":
        if ((parent as ESTree.SequenceExpression).expressions.at(-1) !== child) return false;
        break;
      case "ArrowFunctionExpression":
        if ((parent as ESTree.ArrowFunctionExpression).body !== child) return false;
        break;
      default:
        return false;
    }
    child = parent;
    parent = parents.get(child);
  }
  return false;
}

function pushClassOuterThisExpressions(
  node: ESTree.Node,
  stack: Array<{ node: ESTree.Node; parent: ESTree.Node | null }>,
  parents: WeakMap<ESTree.Node, ESTree.Node>,
): void {
  const classNode = node as unknown as {
    superClass?: unknown;
    body?: { body?: readonly ESTree.Node[] };
  };
  if (isNode(classNode.superClass)) stack.push({ node: classNode.superClass, parent: node });
  for (const element of classNode.body?.body ?? []) {
    parents.set(element, node);
    const member = element as unknown as { computed?: boolean; key?: unknown };
    if (member.computed && isNode(member.key)) stack.push({ node: member.key, parent: element });
  }
}

/** Find observable `this` references belonging to this function. */
export function mapperUsesOwnThis(mapper: ImmediateFunction): boolean {
  // Every form `isFunctionLike` admits has a body. A null body belongs to the
  // TypeScript declaration forms the predicate rejects.
  const body = mapper.body;
  if (!body) return false;
  const stack: Array<{ node: ESTree.Node; parent: ESTree.Node | null }> = [
    { node: body, parent: null },
    ...mapper.params.map((node) => ({ node, parent: null })),
  ];
  const parents = new WeakMap<ESTree.Node, ESTree.Node>();
  const seen = new WeakSet<object>();
  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    if (parent) parents.set(node, parent);
    if (node.type === "ThisExpression") return true;
    if (node.type === "ArrowFunctionExpression" && !nestedArrowCanExposeThis(node, parents)) {
      continue;
    }
    // Class heritage and computed keys run in the surrounding context, while
    // class bodies establish their own strict `this` semantics.
    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      pushClassOuterThisExpressions(node, stack, parents);
      continue;
    }
    // Nested ordinary functions establish a different `this`.
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
      continue;
    }
    visitChildren(node, (child) => {
      if (isNode(child)) stack.push({ node: child, parent: node });
    });
  }
  return false;
}
