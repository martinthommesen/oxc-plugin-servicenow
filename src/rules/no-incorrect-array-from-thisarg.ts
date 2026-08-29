import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import {
  createEmptyArrayBindingQuery,
  findStablePlatformStaticMethodCalls,
  getAncestors,
  isDefinitelyNullishValue,
  resolveDominatingConstValue,
  type BindingWriteQuery,
  type EmptyArrayBindingQuery,
  type FileBindings,
} from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { getStringValue, isNode, unwrapExpression, WALK_SKIP_KEYS } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const METHODS = { Array: ["from"] } as const;

interface MapperFunction {
  readonly type: "FunctionDeclaration" | "FunctionExpression" | "ArrowFunctionExpression";
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node;
}

function isMapperFunction(node: unknown): node is MapperFunction {
  return (
    isNode(node) &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression")
  );
}

/** Resolve only a callable whose exact function syntax is stable at the call. */
function stableMapperFunction(
  node: unknown,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
): MapperFunction | null {
  const value = resolveDominatingConstValue(node, bindings);
  if (!value) return null;
  if (isMapperFunction(value)) return value;
  if (value.type !== "Identifier") return null;
  const binding = bindings.resolve(value.name, value);
  if (
    binding?.kind !== "function" ||
    binding.node.type !== "FunctionDeclaration" ||
    bindingWrites.isWritten(binding.id)
  ) {
    return null;
  }
  return binding.node as MapperFunction;
}

/**
 * Primitive this arguments reached `ensureScriptable()` before Australia and
 * therefore threw instead of following ordinary strict/sloppy call semantics.
 * Keep the proof to direct or dominating static primitives.
 */
function isDefinitelyPrimitiveThisArgument(node: unknown, bindings: FileBindings): boolean {
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

function isDefinitelyEmptyMapperSource(
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
function isDefinitelySloppyMapper(context: Context, mapper: MapperFunction): boolean {
  if (bodyHasUseStrictDirective(mapper.body)) return false;
  const ancestors = getAncestors(context, mapper as ESTree.Node);
  if (!ancestors.some((ancestor) => ancestor.type === "Program")) return false;
  for (const ancestor of ancestors) {
    if (ancestor.type === "ClassDeclaration" || ancestor.type === "ClassExpression") return false;
    if (ancestor.type === "Program" && bodyHasUseStrictDirective(ancestor)) return false;
    if (isMapperFunction(ancestor) && bodyHasUseStrictDirective(ancestor.body)) return false;
  }
  return true;
}

function nestedArrowCanExposeThis(
  arrow: MapperFunction,
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
function mapperUsesOwnThis(mapper: MapperFunction): boolean {
  const stack: Array<{ node: ESTree.Node; parent: ESTree.Node | null }> = [
    { node: mapper.body, parent: null },
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
    for (const key of Object.keys(node)) {
      if (WALK_SKIP_KEYS.has(key)) continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) stack.push({ node: child, parent: node });
      } else if (isNode(value)) {
        stack.push({ node: value, parent: node });
      }
    }
  }
  return false;
}

export const noIncorrectArrayFromThisarg = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Array.from mapper thisArg patterns whose behavior is corrected by ServiceNow Australia.",
      url: ruleDocsUrl("no-incorrect-array-from-thisarg"),
    },
    messages: {
      primitive:
        "Zurich's `Array.from()` throws before mapping when its mapper `thisArg` is a primitive value. Pass an object, omit the third argument when its semantics are suitable, or upgrade to Australia.",
      omitted:
        "Zurich's `Array.from()` gives this non-strict mapper `undefined` instead of the global object when the third argument is omitted. Pass the intended object explicitly or upgrade to Australia.",
    },
  },
  createOnce(context) {
    const ownThisCache = new WeakMap<MapperFunction, boolean>();
    const sloppyCache = new WeakMap<MapperFunction, boolean>();
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (
          script.javascriptMode !== "es2021" ||
          !shouldDiagnoseFeature(script, "array-from-thisarg")
        ) {
          return false;
        }
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        const findings = findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          methods: METHODS,
          namespaces: ["globalThis"],
          mutationSemantics: "authority",
        });
        const stableArrayFromSources = new Set<ESTree.Node>();
        const inlineArrayFromMappers = new Set<ESTree.Node>();
        for (const finding of findings) {
          const source = unwrapExpression(finding.node.arguments[0]);
          if (isNode(source)) stableArrayFromSources.add(source);
          const mapper = unwrapExpression(finding.node.arguments[1]);
          if (isMapperFunction(mapper)) inlineArrayFromMappers.add(mapper as ESTree.Node);
        }
        const bindingReferences = createEmptyArrayBindingQuery(
          node as ESTree.Node,
          analysis.bindings,
          {
            knownNonMutatingReferences: stableArrayFromSources,
            ignoredSubtrees: inlineArrayFromMappers,
          },
        );
        for (const finding of findings) {
          const call = finding.node;
          if (call.arguments.some((argument) => argument.type === "SpreadElement")) continue;
          const source = call.arguments[0];
          const mapperArgument = call.arguments[1];
          if (!source || !mapperArgument) continue;
          // Both releases fail before mapper-this handling for nullish input.
          if (isDefinitelyNullishValue(source, analysis.bindings)) continue;

          const mapper = stableMapperFunction(
            mapperArgument,
            analysis.bindings,
            file.bindingWrites,
          );
          if (!mapper) continue;

          const thisArgument = call.arguments[2];
          if (thisArgument) {
            if (isDefinitelyPrimitiveThisArgument(thisArgument, analysis.bindings)) {
              context.report({ node: call, messageId: "primitive" });
            }
            continue;
          }

          if (isDefinitelyEmptyMapperSource(source, analysis.bindings, bindingReferences)) {
            continue;
          }

          // Arrow functions ignore Call's thisArgument in both releases.
          if (mapper.type === "ArrowFunctionExpression") continue;
          let usesOwnThis = ownThisCache.get(mapper);
          if (usesOwnThis === undefined) {
            usesOwnThis = mapperUsesOwnThis(mapper);
            ownThisCache.set(mapper, usesOwnThis);
          }
          if (!usesOwnThis) continue;
          let sloppy = sloppyCache.get(mapper);
          if (sloppy === undefined) {
            sloppy = isDefinitelySloppyMapper(context, mapper);
            sloppyCache.set(mapper, sloppy);
          }
          if (sloppy) context.report({ node: call, messageId: "omitted" });
        }
      },
    };
  },
});
