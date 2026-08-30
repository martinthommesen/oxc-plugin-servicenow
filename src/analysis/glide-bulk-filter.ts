import type { ESTree } from "@oxlint/plugins";
import { getStringValue } from "../utils/ast.js";
import { classifyStaticArg } from "./static-args.js";
import { analyzePathBindings, dedupePathFindings, mergeTri } from "./path-state.js";
import {
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface UnfilteredBulkFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
}

interface FilterData {
  filtered: boolean | "unknown";
  /** Dynamic/undocumented evidence is intentionally silent rather than a must-fact failure. */
  uncertain: boolean;
}

const FIELD_OR_ENCODED_FILTERS = new Set([
  "addQuery",
  "addEncodedQuery",
  "addUserQuery",
  "addUserEncodedQuery",
  "addSystemQuery",
  "addSystemEncodedQuery",
  "addNullQuery",
  "addNotNullQuery",
  "addJoinQuery",
]);

/**
 * A recognized filter counts only when the call supplies restricting input.
 *
 * `addActiveQuery()` is restricting with no arguments.
 * Missing or statically empty field/encoded-query arguments do not count.
 * Dynamic arguments become unknown and stay silent.
 */
function filterEvidence(
  property: string,
  call: ESTree.CallExpression,
  analysis: ProvenanceQuery,
): boolean | "unknown" | null {
  if (!analysis.glide.filters.has(property)) return null;
  if (property === "addActiveQuery") return true;
  if (!FIELD_OR_ENCODED_FILTERS.has(property)) return "unknown";

  const first = classifyStaticArg(call.arguments[0], analysis);
  switch (first) {
    case "missing":
    case "empty":
      return false;
    case "present":
      return getStringValue(call.arguments[0]) !== null;
    case "unknown":
      return "unknown";
    default: {
      const exhaustive: never = first;
      return exhaustive;
    }
  }
}

export function findUnfilteredBulkOperations(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): UnfilteredBulkFinding[] {
  const findings: UnfilteredBulkFinding[] = [];
  // Keyed on node identity: nodeStart() returns -1 on a host whose nodes
  // carry no offset shape, which would collapse every finding in the file
  // onto one key and silently drop all but the first (FINDINGS.md COR-016).
  const reported = new Set<ESTree.Node>();
  analyzePathBindings<FilterData>({
    program,
    analysis,
    kinds: ["GlideRecord"],
    emptyData: () => ({ filtered: false, uncertain: false }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) =>
      left.filtered === right.filtered && left.uncertain === right.uncertain,
    mergeData: (left, right) => ({
      filtered: mergeTri(left.filtered, right.filtered),
      uncertain: left.uncertain || right.uncertain,
    }),
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !objectName || !property) return;
      if (!hasAuthoritativeGlideRecordMethod(authority, receiver, property)) {
        rec.data.filtered = "unknown";
        rec.data.uncertain = true;
        return;
      }
      const evidence = filterEvidence(property, call, analysis);
      if (evidence === true) {
        rec.data.filtered = true;
        rec.data.uncertain = false;
        return;
      }
      if (evidence === "unknown") {
        rec.data.filtered = mergeTri(rec.data.filtered, "unknown");
        rec.data.uncertain = true;
        return;
      }
      if (evidence === false) {
        return;
      }
      if (
        analysis.glide.bulk.has(property) &&
        (rec.data.filtered === false || (rec.data.filtered === "unknown" && !rec.data.uncertain))
      ) {
        if (!reported.has(call)) {
          reported.add(call);
          findings.push({ node: call, name: objectName, method: property });
        }
        return;
      }
      if (!analysis.glide.modeledMethods.has(property) && rec.data.filtered !== true) {
        rec.data.filtered = "unknown";
        rec.data.uncertain = true;
      }
    },
    onBudgetExceeded() {
      findings.length = 0;
    },
  });
  return dedupePathFindings(findings);
}
