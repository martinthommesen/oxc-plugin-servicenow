import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import {
  findStablePlatformStaticMethodCalls,
  getAncestors,
  isDefinitelyNullishValue,
  resolveDominatingConstValue,
  type BindingWriteQuery,
  type FileBindings,
} from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { getStringValue, isNode, WALK_SKIP_KEYS } from "../utils/ast.js";
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

function isDefinitelyEmptyMapperSource(node: unknown, bindings: FileBindings): boolean {
  const value = resolveDominatingConstValue(node, bindings);
  if (!value) return false;
  if (value.type === "ArrayExpression") return value.elements.length === 0;
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
    const value = getStringValue(expression);
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

/** Find `this` references belonging to this function, including lexical arrows. */
function mapperUsesOwnThis(mapper: MapperFunction): boolean {
  const stack: ESTree.Node[] = [mapper.body, ...mapper.params];
  const seen = new WeakSet<object>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    if (node.type === "ThisExpression") return true;
    // Nested ordinary functions and classes establish a different `this`.
    // Nested arrows deliberately remain traversable because they capture the
    // mapper's `this`, even when the arrow escapes and runs later.
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ClassDeclaration" ||
      node.type === "ClassExpression"
    ) {
      continue;
    }
    for (const key of Object.keys(node)) {
      if (WALK_SKIP_KEYS.has(key)) continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) stack.push(child);
      } else if (isNode(value)) {
        stack.push(value);
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
        for (const finding of findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          methods: METHODS,
          namespaces: ["globalThis"],
          mutationSemantics: "authority",
        })) {
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

          if (isDefinitelyEmptyMapperSource(source, analysis.bindings)) continue;

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
