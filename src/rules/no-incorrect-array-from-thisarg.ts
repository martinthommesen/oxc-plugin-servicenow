import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  createEmptyArrayBindingQuery,
  findStablePlatformStaticMethodCalls,
  isDefinitelyEmptyMapperSource,
  isDefinitelyNullishValue,
  isDefinitelyPrimitiveThisArgument,
  isDefinitelySloppyMapper,
  isFunctionLike,
  mapperUsesOwnThis,
  resolveStableCallable,
  type ImmediateFunction,
} from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const METHODS = { Array: ["from"] } as const;

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
    const ownThisCache = new WeakMap<ImmediateFunction, boolean>();
    const sloppyCache = new WeakMap<ImmediateFunction, boolean>();
    return {
      before() {
        const { script } = beginRuleFile(context);
        if (
          script.javascriptMode !== "es2021" ||
          !shouldDiagnoseFeature(script, "array-from-thisarg")
        ) {
          return false;
        }
        return undefined;
      },
      Program(node) {
        const file = beginRuleFile(context);
        const findings = findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          file,
          methods: METHODS,
          namespaces: ["globalThis"],
          mutationSemantics: "authority",
        });
        const stableArrayFromSources = new Set<ESTree.Node>();
        const inlineArrayFromMappers = new Set<ESTree.Node>();
        for (const finding of findings) {
          const source = unwrapExpression(finding.arguments?.[0]);
          if (isNode(source)) stableArrayFromSources.add(source);
          const mapper = unwrapExpression(finding.arguments?.[1]);
          if (isFunctionLike(mapper)) inlineArrayFromMappers.add(mapper as ESTree.Node);
        }
        const bindingReferences = createEmptyArrayBindingQuery(
          node as ESTree.Node,
          file.provenance.bindings,
          {
            knownNonMutatingReferences: stableArrayFromSources,
            ignoredSubtrees: inlineArrayFromMappers,
          },
        );
        for (const finding of findings) {
          const call = finding.node;
          const semanticArguments = finding.arguments;
          if (!semanticArguments) continue;
          const source = semanticArguments[0];
          const mapperArgument = semanticArguments[1];
          if (!source || !mapperArgument) continue;
          // Both releases fail before mapper-this handling for nullish input.
          if (isDefinitelyNullishValue(source, file.provenance.bindings)) continue;

          const mapper = resolveStableCallable(
            mapperArgument,
            file.provenance.bindings,
            file.bindingWrites,
          );
          if (!mapper) continue;

          const thisArgument = semanticArguments[2];
          if (thisArgument) {
            if (isDefinitelyPrimitiveThisArgument(thisArgument, file.provenance.bindings)) {
              context.report({ node: call, messageId: "primitive" });
            }
            continue;
          }

          if (isDefinitelyEmptyMapperSource(source, file.provenance.bindings, bindingReferences)) {
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
