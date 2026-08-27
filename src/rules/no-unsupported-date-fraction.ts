import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  findStablePlatformConstructorCalls,
  findStablePlatformStaticMethodCalls,
  resolveDominatingConstValue,
} from "../analysis/internal.js";
import { ruleDocsUrl } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { getStaticStringValue } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const DATE_NAMES = ["Date"] as const;
const DATE_METHODS = { Date: ["parse"] } as const;
const ISO_DATE_TIME_FRACTION =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d+)(?:Z|([+-])(\d{2}):(\d{2}))?$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Return the release-sensitive fraction length only for a complete timestamp
 * that the Australia parser accepts. Invalid and broader legacy date forms
 * deliberately stay outside this rule.
 */
function variableFractionDigits(value: string): number | null {
  const match = ISO_DATE_TIME_FRACTION.exec(value);
  if (!match) return null;
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  const hourText = match[4];
  const minuteText = match[5];
  const secondText = match[6];
  const fraction = match[7];
  if (!yearText || !monthText || !dayText || !hourText || !minuteText || !secondText || !fraction) {
    return null;
  }
  if (fraction.length === 3) return null;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const milliseconds = Number(fraction.slice(0, 3).padEnd(3, "0"));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 24 ||
    minute > 59 ||
    second > 59 ||
    (hour === 24 && (minute !== 0 || second !== 0 || milliseconds !== 0))
  ) {
    return null;
  }

  if (match[8] !== undefined) {
    const offsetHour = match[9];
    const offsetMinute = match[10];
    if (
      offsetHour === undefined ||
      offsetMinute === undefined ||
      Number(offsetHour) > 23 ||
      Number(offsetMinute) > 59
    ) {
      return null;
    }
  }
  return fraction.length;
}

export const noUnsupportedDateFraction = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow variable-length ISO date fractions in native Date parsing when the configured ServiceNow release does not support them.",
      url: ruleDocsUrl("no-unsupported-date-fraction"),
    },
    messages: {
      unsupported:
        "`{{operation}}` does not support {{digits}} in an ISO fractional second in the configured ServiceNow release. Use exactly three digits for release-portable parsing.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        if (!shouldDiagnoseFeature(script, "date-fraction-digits")) return false;
      },
      Program(node) {
        const { analysis, file } = beginRuleFile(context);
        const report = (
          invocation: ESTree.CallExpression | ESTree.NewExpression,
          operation: string,
        ): void => {
          const argument = resolveDominatingConstValue(invocation.arguments[0], analysis.bindings);
          const value = argument ? getStaticStringValue(argument) : null;
          const digits = value === null ? null : variableFractionDigits(value);
          if (digits === null) return;
          context.report({
            node: invocation,
            messageId: "unsupported",
            data: {
              digits: `${digits} ${digits === 1 ? "digit" : "digits"}`,
              operation,
            },
          });
        };

        for (const finding of findStablePlatformConstructorCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          names: DATE_NAMES,
          namespaces: ["globalThis"],
          mutationSemantics: "authority",
        })) {
          if (finding.node.type !== "NewExpression" || finding.node.arguments.length !== 1) {
            continue;
          }
          report(finding.node, "new Date()");
        }

        for (const finding of findStablePlatformStaticMethodCalls({
          program: node as ESTree.Node,
          analysis,
          bindingWrites: file.bindingWrites,
          mutations: file.mutations,
          methods: DATE_METHODS,
          namespaces: ["globalThis"],
          mutationSemantics: "authority",
        })) {
          if (finding.node.arguments.length > 0) report(finding.node, "Date.parse()");
        }
      },
    };
  },
});
