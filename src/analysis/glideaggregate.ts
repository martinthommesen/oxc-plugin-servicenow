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
  aggregates: Set<string>;
  dynamicAggregate: boolean;
}

function tupleKey(type: string, field: string | null): string {
  return field ? `${type}:${field}` : type;
}

function cloneAgg(data: AggData): AggData {
  return {
    queried: data.queried,
    aggregates: new Set(data.aggregates),
    dynamicAggregate: data.dynamicAggregate,
  };
}

/**
 * Report `next` / `getAggregate` before `query`, and static getAggregate
 * tuples that were never registered. Dynamic names stay silent.
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
    emptyData: () => ({ queried: false, aggregates: new Set(), dynamicAggregate: false }),
    cloneData: cloneAgg,
    mergeData: (left, right) => ({
      queried: mergeTri(left.queried, right.queried),
      aggregates: new Set([...left.aggregates, ...right.aggregates]),
      dynamicAggregate: left.dynamicAggregate || right.dynamicAggregate,
    }),
    onCall({ call, rec, objectName, property }) {
      if (!rec || !objectName || !property) return;
      if (property === "addAggregate") {
        const type = getStringValue(call.arguments[0]);
        const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
        if (!type || (call.arguments[1] && field === null)) {
          rec.data.dynamicAggregate = true;
        } else {
          rec.data.aggregates.add(tupleKey(type, field || null));
        }
      }
      if (property === "query") rec.data.queried = true;
      if (property === "next" || property === "getAggregate") {
        if (rec.data.queried === false) {
          findings.push({ node: call, name: objectName, messageId: "missingQuery", method: property });
        }
      }
      if (property === "getAggregate" && rec.data.queried !== false && !rec.data.dynamicAggregate) {
        const type = getStringValue(call.arguments[0]);
        const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
        if (type && (!call.arguments[1] || field !== null)) {
          const key = tupleKey(type, field || null);
          if (!rec.data.aggregates.has(key) && !rec.data.aggregates.has(type)) {
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
