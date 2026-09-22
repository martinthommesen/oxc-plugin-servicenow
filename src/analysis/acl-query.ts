import type { ESTree } from "@oxlint/plugins";
import { collectPathFindings } from "./path-state.js";
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

interface AclQueryFinding {
  node: ESTree.CallExpression;
  name: string;
  method: string;
  kind: QueryKind;
}

const DEFAULT_RECEIVER_NAME: Readonly<Record<QueryReceiverKind, string>> = {
  current: "current",
  GlideRecord: "record",
  GlideAggregate: "aggregate",
};

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
  return collectPathFindings<AclQueryData, AclQueryFinding>(
    {
      program,
      analysis,
      kinds: ["GlideRecord", "GlideAggregate"],
      emptyData: () => ({ kind: null }),
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
      onCall({ call, rec, receiver, objectName, property }, report) {
        if (!rec || !receiver || !property || !rec.data.kind) return;
        const kind = rec.data.kind;
        let authoritative: boolean;
        switch (kind) {
          case "GlideRecord":
            authoritative =
              analysis.glide.byKind.GlideRecord.executors.has(property) &&
              hasAuthoritativeGlideRecordMethod(authority, receiver, property);
            break;
          case "GlideAggregate":
            authoritative =
              analysis.glide.byKind.GlideAggregate.executors.has(property) &&
              hasAuthoritativeConstructedMethod(authority, receiver, "GlideAggregate", property);
            break;
          case "current":
            authoritative =
              analysis.glide.byKind.GlideRecord.executors.has(property) &&
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
        report({
          node: call,
          name: objectName ?? DEFAULT_RECEIVER_NAME[kind],
          method: property,
          kind: kind === "current" ? "GlideRecord" : kind,
        });
      },
    },
    (finding) => `${finding.kind}:${finding.method}`,
  );
}
