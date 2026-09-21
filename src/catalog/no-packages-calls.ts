import { entry } from "./entry.js";
import { noPackagesCalls } from "../rules/no-packages-calls.js";
import * as metadata from "../catalog-metadata.js";

export const noPackagesCallsEntry = entry("no-packages-calls", noPackagesCalls, {
  ...metadata.meta(metadata.classic(metadata.SERVER_SURFACES), [
    metadata.evidenceRecord(
      metadata.SN_PACKAGES_REMOVAL,
      "The Australia Packages Call Removal Tool says Packages calls to ServiceNow Java classes will be prevented in a future release.",
      "manual",
      "2026-08-22",
    ),
    metadata.evidenceRecord(
      "tests/rules/glide-and-engine.test.ts",
      "Fixtures cover static and dynamic Packages access versus local bindings named Packages.",
      "fixture",
      "2026-08-21",
    ),
  ]),
  placements: [{ profile: "policy", severity: "warn" }],
  optionDescriptor: undefined,
  limitationCases: [
    {
      caseId: "packages-non-servicenow-java-class",
      kind: "false-positive",
      description:
        "The syntax-only review also flags Java classes outside the scope of the ServiceNow class-removal tool.",
      name: "non-ServiceNow Java class",
      filename: "src/server/java-bridge.js",
      code: `var value = new Packages.java.lang.String("value");`,
    },
    {
      caseId: "packages-mid-server-execution",
      kind: "false-positive",
      description:
        "Static source alone cannot prove that a record executes on a MID Server, which Australia documents as a separate review outcome.",
      name: "MID Server execution boundary",
      filename: "src/server/mid-probe.js",
      code: `var probe = Packages.com.glide.util.NetProbe;`,
    },
  ],
  title: "Review Packages.*",
  family: "classic",
  severity: "warn",
  fixable: false,
  hasSuggestions: false,
  description:
    "Optional migration policy. Review Rhino `Packages.*` bridge calls; Australia's removal tool specifically targets ServiceNow Java classes and distinguishes MID Server execution.",
  bad: [
    {
      name: "Packages call",
      filename: "script-include.js",
      code: `var result = Packages.com.glide.sys.GlideSystem.now();`,
    },
  ],
  good: [
    {
      name: "Glide API",
      filename: "script-include.js",
      code: `var result = new GlideDateTime();`,
    },
  ],
});
