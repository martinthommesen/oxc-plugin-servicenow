import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { ruleDocsUrl } from "../constants.js";
import { staticPropertyName } from "../analysis/internal.js";
import { getName } from "../utils/ast.js";
import { appliesOnSurface, isServerInstanceContext } from "../context/index.js";
import { beginRuleFile } from "./helpers.js";

export const noGsNow = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `gs.now()` and `gs.nowDateTime()`. They return timezone-sensitive display strings. `gs.now()` is unavailable on the client since London.",
      url: ruleDocsUrl("no-gs-now"),
    },
    messages: {
      client:
        "`gs.now()` has not been available in client scripts since London. Ask the server for a GlideDateTime display value.",
      server:
        "`gs.now()` returns a display string in the session timezone and is easy to misuse. Prefer `new GlideDateTime()` when you need an object, or an explicit display-value API when you need a string.",
      nowDateTime:
        "`gs.nowDateTime()` returns a display string in the session timezone. Prefer `new GlideDateTime()` or an explicit display-value API.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { analysis, context: script, file } = beginRuleFile(context);
        const client = appliesOnSurface(script, "client", "filename");
        const server = isServerInstanceContext(script, "filename");
        if (!client && !server) return;
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const directGlobal =
          getName(member.object) === "gs" &&
          analysis.isPlatformGlobal(member.object as ESTree.Node);
        const proven = analysis.ofExpression(member.object);
        const alias = proven?.kind === "gs" && !proven.invalid && !proven.escaped;
        if (!directGlobal && !alias) return;
        const property = staticPropertyName(member);
        const isNow = property === "now";
        const isNowDateTime = property === "nowDateTime";
        if (!isNow && !isNowDateTime) return;
        if (file.bindingWrites.hasDynamicScope()) return;
        if (directGlobal && file.mutations.isGlobalAuthorityLost("gs")) return;
        if (
          file.mutations.isGlobalPathAuthorityLost(["gs", property]) ||
          file.mutations.isObjectPropertyAuthorityLost(member.object, property)
        ) {
          return;
        }
        const messageId = isNowDateTime ? "nowDateTime" : client ? "client" : "server";
        context.report({ node, messageId });
      },
    };
  },
});
