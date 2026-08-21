import type { ESTree } from "@oxlint/plugins";
import { getName, getStringValue, isNode, unwrapExpression } from "../utils/ast.js";
import type { ProvenanceQuery } from "./provenance.js";

export type StaticArgEvidence = "missing" | "empty" | "present" | "unknown";

/**
 * Classify one call argument as static evidence.
 *
 * Missing, `null`, `undefined`, `void`, and empty strings are empty.
 * A non-empty static string or other literal is present.
 * Dynamic expressions stay unknown.
 */
export function classifyStaticArg(arg: unknown, analysis?: ProvenanceQuery): StaticArgEvidence {
  if (arg === undefined || arg === null) return "missing";
  if (!isNode(arg)) return "unknown";
  if (arg.type === "SpreadElement") return "unknown";
  const value = unwrapExpression(arg);
  if (!isNode(value)) return "unknown";

  if (value.type === "Identifier" && getName(value) === "undefined") {
    return !analysis || analysis.isPlatformGlobal(value) ? "empty" : "unknown";
  }
  if (value.type === "UnaryExpression" && (value as ESTree.UnaryExpression).operator === "void") {
    return "empty";
  }
  if (value.type === "ObjectExpression" || value.type === "ArrayExpression") return "present";
  const literalNode = value as { type?: string; value?: unknown };
  if (literalNode.type === "Literal" || literalNode.type === "StringLiteral") {
    const literal = literalNode.value;
    if (literal === "" || literal === null || literal === undefined) return "empty";
    if (typeof literal === "string") return literal.length > 0 ? "present" : "empty";
    return "present";
  }

  const staticString = getStringValue(value);
  if (staticString !== null) {
    return staticString.length > 0 ? "present" : "empty";
  }
  return "unknown";
}
