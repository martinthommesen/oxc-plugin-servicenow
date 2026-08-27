import type { ESTree } from "@oxlint/plugins";
import { analyzePathBindings, dedupePathFindings } from "./path-state.js";
import {
  hasAuthoritativeConstructedMethod,
  hasAuthoritativeGlobalObjectMethod,
  hasAuthoritativeGlideRecordMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

type QueryKind = "GlideRecord" | "GlideAggregate";
type QueryReceiverKind = QueryKind | "current";

interface AclQueryData {
  kind: QueryReceiverKind | null;
}

export interface AclQueryFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
  kind: QueryKind;
}

function queryKindAt(analysis: ProvenanceQuery, node: ESTree.Node): QueryReceiverKind | null {
  const proven = analysis.ofExpression(node);
  return proven?.kind === "GlideRecord" ||
    proven?.kind === "GlideAggregate" ||
    proven?.kind === "current"
    ? proven.kind
    : null;
}

/**
 * Find proven database-query executions on the immediate ACL evaluation path.
 *
 * Object identity, aliases, branches, abrupt completion, escape, and direct
 * local helper calls come from the shared path engine. Uncalled functions and
 * deferred callbacks are deliberately skipped: their execution is not proven
 * to be part of this ACL evaluation.
 */
export function findAclQueries(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): AclQueryFinding[] {
  const findings: AclQueryFinding[] = [];

  analyzePathBindings<AclQueryData>({
    program,
    analysis,
    kinds: ["GlideRecord", "GlideAggregate"],
    emptyData: () => ({ kind: null }),
    cloneData: (data) => ({ ...data }),
    equalsData: (left, right) => left.kind === right.kind,
    mergeData: (left, right) => ({ kind: left.kind === right.kind ? left.kind : null }),
    mergeDistinctData: (left, right) =>
      left.kind !== null && left.kind === right.kind ? { kind: left.kind } : undefined,
    analyzeUncalledFunctions: false,
    stopAtAwait: true,
    retainUnboundRecords: false,
    onRef({ node, rec }) {
      if (!rec || rec.data.kind !== null) return;
      rec.data.kind = queryKindAt(analysis, node);
    },
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !property || !rec.data.kind) return;
      const kind = rec.data.kind;
      let authoritative: boolean;
      switch (kind) {
        case "GlideRecord":
          authoritative =
            analysis.glide.executors.has(property) &&
            hasAuthoritativeGlideRecordMethod(authority, receiver, property);
          break;
        case "GlideAggregate":
          authoritative =
            property === "query" &&
            hasAuthoritativeConstructedMethod(authority, receiver, "GlideAggregate", property);
          break;
        case "current":
          authoritative =
            analysis.glide.executors.has(property) &&
            hasAuthoritativeGlobalObjectMethod(authority, receiver, "current", property, {
              prototypeConstructor: "GlideRecord",
            });
          break;
        default: {
          const unexpected: never = kind;
          return unexpected;
        }
      }
      if (!authoritative) return;
      findings.push({
        node: call,
        name:
          objectName ??
          (kind === "current" ? "current" : kind === "GlideRecord" ? "record" : "aggregate"),
        method: property,
        kind: kind === "current" ? "GlideRecord" : kind,
      });
    },
    onBudgetExceeded() {
      findings.length = 0;
    },
  });

  return dedupePathFindings(findings, (finding) => `${finding.kind}:${finding.method}`);
}
