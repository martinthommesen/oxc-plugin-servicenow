import type { ESTree } from "@oxlint/plugins";
import { getStringValue } from "../utils/ast.js";
import { analyzePathBindings, mergeTri } from "./path-state.js";
import type { ProvenanceQuery } from "./provenance.js";

export interface AggregateFinding {
  node: ESTree.CallExpression;
  name: string;
  messageId: "missingQuery" | "unknownAggregate";
  method: string;
  tuple?: string;
}

interface AggData {
  queried: boolean | "unknown";
  committed: Set<string>;
  pending: Set<string>;
  dynamicAggregate: boolean;
}

function tupleKey(type: string, field: string | null): string {
  return field ? `${type}:${field}` : type;
}

function cloneSet(values: Set<string>): Set<string> {
  return new Set(values);
}

function intersectSet(left: Set<string>, right: Set<string>): Set<string> {
  return new Set([...left].filter((item) => right.has(item)));
}

function cloneAgg(data: AggData): AggData {
  return {
    queried: data.queried,
    committed: cloneSet(data.committed),
    pending: cloneSet(data.pending),
    dynamicAggregate: data.dynamicAggregate,
  };
}

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
): AggregateFinding[] {
  const findings: AggregateFinding[] = [];
  analyzePathBindings<AggData>({
    program,
    analysis,
    kinds: ["GlideAggregate"],
    emptyData: () => ({
      queried: false,
      committed: new Set(),
      pending: new Set(),
      dynamicAggregate: false,
    }),
    cloneData: cloneAgg,
    mergeData: (left, right) => ({
      queried: mergeTri(left.queried, right.queried),
      committed: intersectSet(left.committed, right.committed),
      pending: intersectSet(left.pending, right.pending),
      dynamicAggregate: left.dynamicAggregate || right.dynamicAggregate,
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (property === "addAggregate") {
        const type = getStringValue(call.arguments[0]);
        const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
        if (!type || (call.arguments[1] && field === null)) {
          rec.data.dynamicAggregate = true;
          return;
        }
        rec.data.pending.add(tupleKey(type, field || null));
      }
      if (property === "query") {
        rec.data.committed = cloneSet(rec.data.pending);
        rec.data.queried = true;
      }
      if (property === "next" || property === "getAggregate") {
        if (rec.data.queried === false || rec.data.queried === "unknown") {
          findings.push({ node: call, name: objectName, messageId: "missingQuery", method: property });
        }
      }
      if (property === "getAggregate" && rec.data.queried === true && !rec.data.dynamicAggregate) {
        const type = getStringValue(call.arguments[0]);
        const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
        if (type && (!call.arguments[1] || field !== null)) {
          const key = tupleKey(type, field || null);
          if (!rec.data.committed.has(key)) {
            findings.push({
              node: call,
              name: objectName,
              messageId: "unknownAggregate",
              method: property,
              tuple: key,
            });
          }
        }
      }
    },
  });
  return findings;
}
