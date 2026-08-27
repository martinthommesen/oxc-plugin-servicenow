import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { findStablePlatformStaticMethodCalls } from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const METHODS = { BigInt: ["asUintN"] } as const;

// The rule never expands 2^bits, but bounding literal inputs keeps worst-case
// source conversion predictable on generated or adversarial files.
const MAX_STATIC_BITS = 4_096;
const MAX_BIGINT_LITERAL_CHARACTERS = 256;

function directBigIntLiteral(node: unknown, depth = 0): bigint | null {
  if (depth > 4) return null;
  const value = unwrapExpression(node);
  if (!isNode(value)) return null;
  if (value.type === "UnaryExpression") {
    const unary = value as ESTree.UnaryExpression;
    if (unary.operator !== "-") return null;
    const argument = directBigIntLiteral(unary.argument, depth + 1);
    return argument === null ? null : -argument;
  }
  if (value.type !== "Literal") return null;

  const literal = value as unknown as {
    bigint?: string | null;
    raw?: string | null;
    value?: unknown;
  };
  let source: string | null = null;
  if (typeof literal.raw === "string" && literal.raw.endsWith("n")) {
    source = literal.raw.slice(0, -1).replaceAll("_", "");
  } else if (typeof literal.bigint === "string") {
    source = literal.bigint;
  }
  if (source === null && typeof literal.value === "bigint") {
    source = literal.value.toString();
  }
  if (!source || source.length > MAX_BIGINT_LITERAL_CHARACTERS) return null;
  try {
    return BigInt(source);
  } catch {
    return null;
  }
}

function directBitCount(node: unknown): number | null {
  const value = unwrapExpression(node);
  if (!isNode(value) || value.type !== "Literal") return null;
  const bits = (value as { value?: unknown }).value;
  if (typeof bits !== "number" || !Number.isFinite(bits) || bits < 0) return null;
  const index = Math.trunc(bits);
  return Number.isSafeInteger(index) && index <= MAX_STATIC_BITS ? index : null;
}

function signedBigIntegerByteLength(value: bigint): number {
  // java.math.BigInteger.toByteArray() uses the shortest signed two's-
  // complement representation. For negative values its significant bits are
  // the bits of ~value, which is equivalent to -value - 1.
  const complement = -value - 1n;
  const bitLength = complement === 0n ? 0 : complement.toString(2).length;
  return Math.floor(bitLength / 8) + 1;
}

/** Whether pre-Australia Rhino provably returns the wrong unsigned result. */
function hasLegacyResultMismatch(bits: number, value: bigint): boolean {
  if (bits === 0 || value >= 0n) return false;

  // Before Rhino PR 1979, asUintN returned the original BigInteger whenever
  // the requested byte width exceeded its existing signed byte array. A
  // negative original can never equal the required unsigned result. When this
  // early return is not taken, the legacy mask computes the correct modulo.
  return bits >= signedBigIntegerByteLength(value) * 8;
}

export const noIncorrectBigintAsuintn = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow statically proven BigInt.asUintN calls that return an incorrect negative result before ServiceNow Australia.",
      url: ruleDocsUrl("no-incorrect-bigint-asuintn"),
    },
    messages: {
      incorrect:
        "`BigInt.asUintN()` returns the negative input unchanged for these literal arguments in the configured ServiceNow release. Upgrade to Australia or avoid relying on this narrowing result.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (
          script.javascriptMode !== "es2021" ||
          !shouldDiagnoseFeature(script, "bigint-narrowing")
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
          const bits = directBitCount(finding.node.arguments[0]);
          const value = directBigIntLiteral(finding.node.arguments[1]);
          if (bits === null || value === null || !hasLegacyResultMismatch(bits, value)) continue;
          context.report({ node: finding.node, messageId: "incorrect" });
        }
      },
    };
  },
});
