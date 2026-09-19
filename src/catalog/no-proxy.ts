import { entry, ES5 } from "./entry.js";
import { noProxy } from "../rules/no-proxy.js";
import * as metadata from "../catalog-metadata.js";

export const noProxyEntry = entry("no-proxy", noProxy, {
  ...metadata.meta(
    metadata.engine(metadata.ES5_MODES),
    [
      metadata.evidenceRecord(
        metadata.SN_JS_FEATURES,
        "Proxy is unsupported in Compatibility and ES5 Standards modes.",
        "manual",
        "2026-08-20",
      ),
      metadata.evidenceRecord(
        "tests/rules/no-proxy.test.ts",
        "Fixtures cover stable Proxy constructor and revocable-owner aliases, guarded alias capture, owner-and-method availability checks, modeled built-in invalidation, visible polyfills, mutation, and dynamic scope.",
        "fixture",
        "2026-08-24",
      ),
      metadata.evidenceRecord(
        "tests/integration/profiles.test.ts",
        "Real Oxlint and ESLint classic-es5 profiles report a stable Proxy alias and accept an explicit callable polyfill.",
        "integration-test",
        "2026-08-24",
      ),
    ],
    {
      overlaps: ["servicenow/no-unsupported-syntax"],
    },
  ),
  placements: [{ profile: "classic-es5", severity: "error" }] as const,
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "no-proxy-visible-polyfill",
      kind: "scope-boundary",
      description:
        "A possible callable replacement for Proxy or Proxy.revocable suppresses matching diagnostics throughout the file, regardless of source order.",
      name: "visible Proxy polyfill",
      filename: "polyfill.server.js",
      settings: ES5,
      code: `Proxy = LocalProxy;
var wrapped = new Proxy(target, handler);`,
    },
    {
      caseId: "no-proxy-availability-guard",
      kind: "scope-boundary",
      description:
        "A constructor call protected by a structurally dominating owner guard stays silent; revocable calls require both the Proxy owner and method to be guarded.",
      name: "availability guard",
      filename: "portable.server.js",
      settings: ES5,
      code: `if (typeof Proxy === "function") {
  new Proxy(target, handler);
}`,
    },
    {
      caseId: "no-proxy-cross-execution-alias",
      kind: "false-negative",
      description:
        "A Proxy alias used from another function body stays silent because source order cannot prove that its initializer ran before the function was called.",
      name: "cross-execution alias",
      filename: "deferred.server.js",
      settings: ES5,
      code: `const P = Proxy;
function wrap() { return new P(target, handler); }
wrap();`,
    },
    {
      caseId: "no-proxy-static-method-alias",
      kind: "false-negative",
      description:
        "Direct aliases of Proxy.revocable stay silent; the shared resolver proves stable aliases of the Proxy owner instead.",
      name: "revocable method alias",
      filename: "method-alias.server.js",
      settings: ES5,
      code: `const revocable = Proxy.revocable;
revocable(target, handler);`,
    },
  ],
  title: "No Proxy",
  family: "engine",
  severity: "error",
  fixable: false,
  hasSuggestions: false,
  description:
    "`Proxy` is unsupported in Compatibility and ES5 Standards mode. Direct calls plus stable same-execution constructor and `revocable` owner aliases report; bare aliases must be captured under an owner guard, while fully guarded or visibly polyfilled calls stay silent.",
  bad: [
    {
      name: "new Proxy",
      filename: "script-include.js",
      settings: ES5,
      code: `var p = new Proxy(target, handler);`,
    },
  ],
  good: [
    {
      name: "plain object",
      filename: "script-include.js",
      settings: ES5,
      code: `var p = { prop: value };`,
    },
  ],
});
