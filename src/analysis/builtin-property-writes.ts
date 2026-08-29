import type { ESTree } from "@oxlint/plugins";
import type { JavaScriptMode } from "../types.js";
import { getStaticStringValue, propertyKeyName } from "../utils/ast.js";
import { resolvePlatformGlobalName } from "./globals.js";
import { isDefinitelyNullishValue, resolveConstValue } from "./members.js";
import { resolveBuiltinCall } from "./builtin-calls.js";
import {
  hasAuthoritativeGlobalObjectMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

function objectMayWriteProperty(
  node: unknown,
  property: string,
  analysis: ProvenanceQuery,
): boolean {
  if (isDefinitelyNullishValue(node, analysis.bindings)) return false;
  const value = resolveConstValue(node, analysis.bindings);
  if (!value) return true;
  if (value.type === "Literal" || value.type === "ArrayExpression") return false;
  if (value.type !== "ObjectExpression") return true;
  for (const item of value.properties) {
    if (item.type === "SpreadElement") return true;
    const name = propertyKeyName(item as ESTree.ObjectProperty);
    if (!name || name === property) return true;
  }
  return false;
}

/** Return true when a modeled authoritative built-in call may write one platform property. */
export function builtInCallMayWritePlatformProperty(
  call: ESTree.CallExpression,
  targetName: string,
  property: string,
  javascriptMode: JavaScriptMode,
  analysis: ProvenanceQuery,
  facts: PlatformMethodAuthorityFacts,
  runtime: "instance" | "browser" = "instance",
): boolean {
  const bindings = analysis.bindings;
  const globalThisAvailable =
    runtime === "browser" || (javascriptMode !== "es5" && javascriptMode !== "compatibility");
  const builtin = resolveBuiltinCall(call, bindings, {
    allowGlobalThis: globalThisAvailable,
    allowReflectApply: runtime === "browser",
  });
  if (!builtin || builtin.arguments === null) return false;
  if (builtin.owner === "Reflect" && runtime !== "browser") return false;
  if (builtin.owner !== "Object" && builtin.owner !== "Reflect") return false;
  if (
    builtin.owner === "Object" &&
    (builtin.method === "assign" || builtin.method === "setPrototypeOf") &&
    !globalThisAvailable
  ) {
    return false;
  }
  if (
    !hasAuthoritativeGlobalObjectMethod(facts, builtin.receiver, builtin.owner, builtin.method, {
      runtime,
    })
  ) {
    return false;
  }

  const target = builtin.arguments[0];
  if (!target || resolvePlatformGlobalName(target, bindings) !== targetName) return false;

  if (builtin.method === "defineProperty" || builtin.method === "set") {
    const written = getStaticStringValue(builtin.arguments[1]);
    return written === null || written === property;
  }
  if (builtin.method === "defineProperties") {
    return objectMayWriteProperty(builtin.arguments[1], property, analysis);
  }
  if (builtin.method === "assign") {
    return builtin.arguments
      .slice(1)
      .some((source) => objectMayWriteProperty(source, property, analysis));
  }
  return builtin.method === "setPrototypeOf";
}
