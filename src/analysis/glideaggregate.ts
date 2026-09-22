import type { ESTree } from "@oxlint/plugins";
import { getStringValue } from "../utils/ast.js";
import { collectPathFindings, keyedAlternativeDomain } from "./path-state.js";
import {
  hasAuthoritativeConstructedMethod,
  type PlatformMethodAuthorityFacts,
} from "./platform-method-authority.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface AggregateFinding {
  node: ESTree.CallExpression;
  name: string;
  messageId: "missingQuery" | "unknownAggregate";
  method: string;
  tuple?: string;
}

interface AggregateAlternative {
  queried: boolean;
  committed: Set<string>;
  pending: Set<string>;
  committedDynamic: boolean;
  pendingDynamic: boolean;
  uncertain: boolean;
}

interface AggData {
  alternatives: AggregateAlternative[];
}

function tupleKey(type: string, field: string | null): string {
  return field ? `${type}:${field}` : type;
}

/**
 * The exact `type:field` tuple a registration or read names, or null when the
 * arguments are not both statically known.
 */
function aggregateTuple(call: ESTree.CallExpression): string | null {
  const type = getStringValue(call.arguments[0]);
  const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
  if (!type || (call.arguments[1] && field === null)) return null;
  return tupleKey(type, field || null);
}

function cloneAlternative(value: AggregateAlternative): AggregateAlternative {
  return {
    queried: value.queried,
    committed: new Set(value.committed),
    pending: new Set(value.pending),
    committedDynamic: value.committedDynamic,
    pendingDynamic: value.pendingDynamic,
    uncertain: value.uncertain,
  };
}

function alternativeKey(value: AggregateAlternative): string {
  return JSON.stringify({
    queried: value.queried,
    committed: [...value.committed].sort(),
    pending: [...value.pending].sort(),
    committedDynamic: value.committedDynamic,
    pendingDynamic: value.pendingDynamic,
    uncertain: value.uncertain,
  });
}

const aggregateDomain = keyedAlternativeDomain(alternativeKey, cloneAlternative);

/**
 * Report `next` / `getAggregate` before `query`, and exact getAggregate
 * tuples that were not registered before the current query epoch.
 *
 * Branch joins intersect committed tuples. A type-only registration does
 * not satisfy a field-specific read.
 */
export function findGlideAggregateIssues(
  program: ESTree.Node,
  analysis: ProvenanceQuery,
  authority: PlatformMethodAuthorityFacts,
): AggregateFinding[] {
  return collectPathFindings<AggData, AggregateFinding>(
    {
      program,
      analysis,
      kinds: ["GlideAggregate"],
      emptyData: () => ({
        alternatives: [
          {
            queried: false,
            committed: new Set(),
            pending: new Set(),
            committedDynamic: false,
            pendingDynamic: false,
            uncertain: false,
          },
        ],
      }),
      cloneData: aggregateDomain.cloneData,
      equalsData: aggregateDomain.equalsData,
      mergeData: aggregateDomain.mergeData,
      onCall({ call, rec, receiver, objectName, property }, report) {
        if (!rec || !receiver || !property) return;
        if (!hasAuthoritativeConstructedMethod(authority, receiver, "GlideAggregate", property)) {
          for (const value of rec.data.alternatives) {
            value.pendingDynamic = true;
            value.uncertain = true;
          }
          return;
        }
        if (property === "addAggregate") {
          const tuple = aggregateTuple(call);
          if (tuple === null) {
            for (const value of rec.data.alternatives) value.pendingDynamic = true;
            return;
          }
          for (const value of rec.data.alternatives) value.pending.add(tuple);
        }
        if (analysis.glide.byKind.GlideAggregate.executors.has(property)) {
          for (const value of rec.data.alternatives) {
            value.committed = new Set(value.pending);
            value.committedDynamic = value.pendingDynamic || value.uncertain;
            value.queried = true;
            value.uncertain = false;
          }
        }
        if (property === "next" || property === "getAggregate") {
          if (rec.data.alternatives.some((value) => !value.queried && !value.uncertain)) {
            report({
              node: call,
              name: objectName ?? "aggregate",
              messageId: "missingQuery",
              method: property,
            });
          }
        }
        if (property === "getAggregate") {
          const key = aggregateTuple(call);
          if (
            key !== null &&
            rec.data.alternatives.some(
              (value) =>
                value.queried &&
                !value.uncertain &&
                !value.committedDynamic &&
                !value.committed.has(key),
            )
          ) {
            report({
              node: call,
              name: objectName ?? "aggregate",
              messageId: "unknownAggregate",
              method: property,
              tuple: key,
            });
          }
        }
      },
    },
    (finding) => finding.messageId,
  );
}
