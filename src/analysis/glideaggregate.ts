import type { ESTree } from "@oxlint/plugins";
import { getStringValue, nodeStart } from "../utils/ast.js";
import { analyzePathBindings } from "./path-state.js";
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

function cloneSet(values: Set<string>): Set<string> {
  return new Set(values);
}

function cloneAgg(data: AggData): AggData {
  return { alternatives: data.alternatives.map(cloneAlternative) };
}

function cloneAlternative(value: AggregateAlternative): AggregateAlternative {
  return {
    queried: value.queried,
    committed: cloneSet(value.committed),
    pending: cloneSet(value.pending),
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

function mergeAlternatives(left: AggData, right: AggData): AggData {
  const alternatives = new Map<string, AggregateAlternative>();
  for (const value of [...left.alternatives, ...right.alternatives]) {
    alternatives.set(alternativeKey(value), cloneAlternative(value));
  }
  return { alternatives: [...alternatives.values()] };
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
  authority: PlatformMethodAuthorityFacts,
): AggregateFinding[] {
  const findings: AggregateFinding[] = [];
  const reported = new Set<string>();
  const report = (finding: AggregateFinding): void => {
    const key = `${nodeStart(finding.node)}:${finding.messageId}`;
    if (reported.has(key)) return;
    reported.add(key);
    findings.push(finding);
  };
  analyzePathBindings<AggData>({
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
    cloneData: cloneAgg,
    equalsData: (left, right) =>
      left.alternatives.length === right.alternatives.length &&
      left.alternatives.every(
        (value, index) => alternativeKey(value) === alternativeKey(right.alternatives[index]!),
      ),
    mergeData: mergeAlternatives,
    onCall({ call, rec, receiver, objectName, property }) {
      if (!rec || !receiver || !property) return;
      if (!hasAuthoritativeConstructedMethod(authority, receiver, "GlideAggregate", property)) {
        for (const value of rec.data.alternatives) {
          value.pendingDynamic = true;
          value.uncertain = true;
        }
        return;
      }
      if (property === "addAggregate") {
        const type = getStringValue(call.arguments[0]);
        const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
        if (!type || (call.arguments[1] && field === null)) {
          for (const value of rec.data.alternatives) value.pendingDynamic = true;
          return;
        }
        for (const value of rec.data.alternatives) value.pending.add(tupleKey(type, field || null));
      }
      if (property === "query") {
        for (const value of rec.data.alternatives) {
          value.committed = cloneSet(value.pending);
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
        const type = getStringValue(call.arguments[0]);
        const field = call.arguments[1] ? getStringValue(call.arguments[1]) : "";
        if (type && (!call.arguments[1] || field !== null)) {
          const key = tupleKey(type, field || null);
          if (
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
      }
    },
    onBudgetExceeded() {
      findings.length = 0;
      reported.clear();
    },
  });
  return findings;
}
