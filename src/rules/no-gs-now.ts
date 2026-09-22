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
      before() {
        const { script } = beginRuleFile(context);
        if (
          !appliesOnSurface(script, "client", "filename") &&
          !isServerInstanceContext(script, "filename")
        ) {
          return false;
        }
        return undefined;
      },
      CallExpression(node) {
        const file = beginRuleFile(context);
        // Recomputed here only to choose between the client and server
        // message; `before()` already proved one of the two surfaces applies.
        const client = appliesOnSurface(file.script, "client", "filename");
        const call = node as ESTree.CallExpression;
        if (call.callee.type !== "MemberExpression") return;
        const member = call.callee as ESTree.MemberExpression;
        const directGlobal =
          getName(member.object) === "gs" &&
          file.provenance.isPlatformGlobal(member.object as ESTree.Node);
        const proven = file.provenance.trustedExpression(member.object);
        const alias = proven?.kind === "gs";
        if (!directGlobal && !alias) return;
        const property = staticPropertyName(member);
        const isNow = property === "now";
        const isNowDateTime = property === "nowDateTime";
        if (!isNow && !isNowDateTime) return;
        if (file.bindingWrites.hasDynamicScope()) return;
        if (directGlobal && file.mutations.isGlobalAuthorityLostAt("gs", call)) return;
        if (
          file.mutations.isGlobalPathAuthorityLostAt(["gs", property], call) ||
          file.mutations.isObjectPropertyAuthorityLostAt(member.object, property, call)
        ) {
          return;
        }
        const messageId = isNowDateTime ? "nowDateTime" : client ? "client" : "server";
        context.report({ node, messageId });
      },
    };
  },
});
