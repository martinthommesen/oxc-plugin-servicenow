import type { Context, ESTree } from "@oxlint/plugins";
import { getName, getStringValue, walk } from "../utils/ast.js";
import { resolveConstValue } from "./members.js";
import { getAncestors, type ProvenanceQuery } from "./provenance.js";

type Invocation = ESTree.CallExpression | ESTree.NewExpression;
type AvailabilityAnalysis = Pick<ProvenanceQuery, "bindings" | "isPlatformGlobal">;

export interface AvailabilityGuardOptions {
  /** Whether reading an absent feature yields undefined instead of throwing. */
  allowDirectAccessGuard?: boolean | ((node: unknown) => boolean);
  /**
   * Stable per-feature key used to cache dominating guards per block. Callers
   * sharing a key must also provide equivalent access, direct-guard, and
   * property-existence predicates because those predicates build the cache.
   */
  guardCacheKey?: string;
  /** Recognize a structural property-existence test such as `"x" in owner`. */
  isPropertyExistenceTest?: (property: string, object: ESTree.Node) => boolean;
  isOptionalInvocation?: (invocation: Invocation) => boolean;
}

interface BlockGuardIndex {
  readonly statementIndices: WeakMap<object, number>;
  readonly latestGuardBefore: readonly (number | null)[];
}

const guardIndexBySource = new WeakMap<object, WeakMap<object, Map<string, BlockGuardIndex>>>();

function guardProvesAvailability(
  node: unknown,
  whenTruthy: boolean,
  analysis: AvailabilityAnalysis,
  isAccess: (node: unknown) => boolean,
  allowsDirectAccessGuard: (node: unknown) => boolean,
  isPropertyExistenceTest: (property: string, object: ESTree.Node) => boolean,
): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  if (!value) return false;
  if (isAccess(value)) return allowsDirectAccessGuard(value) && whenTruthy;
  if (value.type === "UnaryExpression" && value.operator === "!") {
    return guardProvesAvailability(
      value.argument,
      !whenTruthy,
      analysis,
      isAccess,
      allowsDirectAccessGuard,
      isPropertyExistenceTest,
    );
  }
  if (value.type === "LogicalExpression") {
    if (value.operator === "&&" && whenTruthy) {
      return (
        guardProvesAvailability(
          value.left,
          true,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        ) ||
        guardProvesAvailability(
          value.right,
          true,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        )
      );
    }
    if (value.operator === "||" && !whenTruthy) {
      return (
        guardProvesAvailability(
          value.left,
          false,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        ) ||
        guardProvesAvailability(
          value.right,
          false,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        )
      );
    }
    return false;
  }
  if (value.type !== "BinaryExpression") return false;
  if (value.operator === "in") {
    const property = getStringValue(resolveConstValue(value.left, analysis.bindings));
    return Boolean(property && whenTruthy && isPropertyExistenceTest(property, value.right));
  }
  const equality = new Set(["==", "===", "!=", "!=="]);
  if (!equality.has(value.operator)) return false;
  const operands: readonly [ESTree.Node, ESTree.Node][] = [
    [value.left as ESTree.Node, value.right as ESTree.Node],
    [value.right as ESTree.Node, value.left as ESTree.Node],
  ];
  for (const [candidate, expected] of operands) {
    if (candidate.type === "UnaryExpression" && candidate.operator === "typeof") {
      if (!isAccess(candidate.argument)) continue;
      const expectedType = getStringValue(resolveConstValue(expected, analysis.bindings));
      if (expectedType !== "function" && expectedType !== "undefined") continue;
      const equal = value.operator === "==" || value.operator === "===";
      const provesAvailable = expectedType === "function" ? equal : !equal;
      return whenTruthy === provesAvailable;
    }
    if (!isAccess(candidate)) continue;
    if (!allowsDirectAccessGuard(candidate)) continue;
    const resolvedExpected = resolveConstValue(expected, analysis.bindings);
    if (!resolvedExpected) continue;
    const expectedName = getName(resolvedExpected);
    const expectedValue = (resolvedExpected as { value?: unknown }).value;
    const globalUndefined =
      expectedName === "undefined" && analysis.isPlatformGlobal(resolvedExpected);
    const voidUndefined =
      resolvedExpected.type === "UnaryExpression" && resolvedExpected.operator === "void";
    if (!globalUndefined && !voidUndefined && expectedValue !== null) continue;
    if (expectedValue === null && (value.operator === "===" || value.operator === "!==")) {
      continue;
    }
    const equal = value.operator === "==" || value.operator === "===";
    return whenTruthy !== equal;
  }
  return false;
}

function isFunctionBoundary(node: ESTree.Node): boolean {
  // Annex-B block function declarations can be visible outside their
  // definition branch. Function and arrow expressions cannot be created on a
  // path that skipped their enclosing availability guard.
  return node.type === "FunctionDeclaration";
}

function sameNode(left: ESTree.Node | null | undefined, right: ESTree.Node): boolean {
  if (!left) return false;
  if (left === right) return true;
  const leftSpan = left as { start?: unknown; end?: unknown };
  const rightSpan = right as { start?: unknown; end?: unknown };
  return (
    left.type === right.type &&
    typeof leftSpan.start === "number" &&
    leftSpan.start === rightSpan.start &&
    typeof leftSpan.end === "number" &&
    leftSpan.end === rightSpan.end
  );
}

function isDeferredFunction(node: ESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function isImmediatelyInvoked(node: ESTree.Node, ancestors: readonly ESTree.Node[]): boolean {
  if (node.type === "FunctionDeclaration") return false;
  const index = ancestors.findIndex((ancestor) => sameNode(ancestor, node));
  if (index <= 0) return false;
  let child = node;
  let cursor = index - 1;
  while (cursor >= 0) {
    const parent = ancestors[cursor]!;
    if (
      (parent.type === "ParenthesizedExpression" ||
        parent.type === "ChainExpression" ||
        parent.type === "TSAsExpression" ||
        parent.type === "TSTypeAssertion" ||
        parent.type === "TSNonNullExpression" ||
        parent.type === "TSSatisfiesExpression") &&
      sameNode((parent as { expression?: ESTree.Node }).expression, child)
    ) {
      child = parent;
      cursor -= 1;
      continue;
    }
    if (
      parent.type === "SequenceExpression" &&
      sameNode((parent as ESTree.SequenceExpression).expressions.at(-1), child)
    ) {
      child = parent;
      cursor -= 1;
      continue;
    }
    return parent.type === "CallExpression" && sameNode(parent.callee, child);
  }
  return false;
}

function containsAccessInvalidation(
  root: ESTree.Node,
  isAccess: (node: unknown) => boolean,
): boolean {
  let invalidated = false;
  const ancestors: ESTree.Node[] = [];
  const isDeferred = (): boolean =>
    ancestors
      .slice(0, -1)
      .some((node) => isDeferredFunction(node) && !isImmediatelyInvoked(node, ancestors));
  walk(
    root,
    {
      AssignmentExpression(node) {
        if (!isDeferred() && isAccess((node as ESTree.AssignmentExpression).left)) {
          invalidated = true;
        }
      },
      UpdateExpression(node) {
        if (!isDeferred() && isAccess((node as ESTree.UpdateExpression).argument)) {
          invalidated = true;
        }
      },
      UnaryExpression(node) {
        const unary = node as ESTree.UnaryExpression;
        if (!isDeferred() && unary.operator === "delete" && isAccess(unary.argument)) {
          invalidated = true;
        }
      },
      ForInStatement(node) {
        if (!isDeferred() && isAccess((node as ESTree.ForInStatement).left)) invalidated = true;
      },
      ForOfStatement(node) {
        if (!isDeferred() && isAccess((node as ESTree.ForOfStatement).left)) invalidated = true;
      },
    },
    ancestors,
  );
  return invalidated;
}

function nodesEvaluatedBefore(parent: ESTree.Node, child: ESTree.Node): readonly ESTree.Node[] {
  if (parent.type === "Program" || parent.type === "BlockStatement") {
    const body = (parent as ESTree.Program | ESTree.BlockStatement).body;
    const index = body.findIndex((statement) => sameNode(statement, child));
    return index > 0 ? body.slice(0, index) : [];
  }
  if (parent.type === "SequenceExpression") {
    const expressions = (parent as ESTree.SequenceExpression).expressions;
    const index = expressions.findIndex((expression) => sameNode(expression, child));
    return index > 0 ? expressions.slice(0, index) : [];
  }
  if (parent.type === "LogicalExpression" || parent.type === "BinaryExpression") {
    const expression = parent as ESTree.LogicalExpression | ESTree.BinaryExpression;
    return sameNode(expression.right as ESTree.Node, child) ? [expression.left as ESTree.Node] : [];
  }
  if (parent.type === "ConditionalExpression") {
    const expression = parent as ESTree.ConditionalExpression;
    return sameNode(expression.consequent, child) || sameNode(expression.alternate, child)
      ? [expression.test]
      : [];
  }
  if (parent.type === "IfStatement") {
    const statement = parent as ESTree.IfStatement;
    return sameNode(statement.consequent, child) || sameNode(statement.alternate, child)
      ? [statement.test]
      : [];
  }
  if (parent.type === "CallExpression" || parent.type === "NewExpression") {
    const expression = parent as ESTree.CallExpression | ESTree.NewExpression;
    if (sameNode(expression.callee, child)) return [];
    const index = expression.arguments.findIndex((argument) => sameNode(argument, child));
    return index >= 0
      ? ([expression.callee, ...expression.arguments.slice(0, index)] as ESTree.Node[])
      : [];
  }
  if (parent.type === "VariableDeclaration") {
    const declarations = (parent as ESTree.VariableDeclaration).declarations;
    const index = declarations.findIndex((declaration) => sameNode(declaration, child));
    return index > 0 ? declarations.slice(0, index) : [];
  }
  if (parent.type === "ArrayExpression") {
    const elements = (parent as ESTree.ArrayExpression).elements;
    const index = elements.findIndex((element) => sameNode(element, child));
    return index > 0
      ? elements
          .slice(0, index)
          .flatMap((element) => (element === null ? [] : [element as ESTree.Node]))
      : [];
  }
  if (parent.type === "ObjectExpression") {
    const properties = (parent as ESTree.ObjectExpression).properties;
    const index = properties.findIndex((property) => sameNode(property, child));
    return index > 0 ? properties.slice(0, index) : [];
  }
  return [];
}

function hasInvalidationOnPath(
  root: ESTree.Node,
  target: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  isAccess: (node: unknown) => boolean,
): boolean {
  const path = [...ancestors, target];
  const rootIndex = path.findIndex((node) => sameNode(node, root));
  if (rootIndex < 0) return false;
  for (let index = rootIndex; index < path.length - 1; index += 1) {
    const parent = path[index]!;
    const child = path[index + 1]!;
    if (
      nodesEvaluatedBefore(parent, child).some((node) => containsAccessInvalidation(node, isAccess))
    ) {
      return true;
    }
  }
  return false;
}

function alwaysExits(statement: ESTree.Node | null): boolean {
  if (!statement) return false;
  if (
    statement.type === "ReturnStatement" ||
    statement.type === "ThrowStatement" ||
    statement.type === "BreakStatement" ||
    statement.type === "ContinueStatement"
  ) {
    return true;
  }
  if (statement.type === "BlockStatement") {
    const body = (statement as ESTree.BlockStatement).body;
    return body.length > 0 && alwaysExits(body[body.length - 1] ?? null);
  }
  if (statement.type === "IfStatement") {
    const branch = statement as ESTree.IfStatement;
    return alwaysExits(branch.consequent) && alwaysExits(branch.alternate);
  }
  return false;
}

function precedingExitGuard(
  source: object,
  parent: ESTree.Node,
  child: ESTree.Node,
  target: ESTree.Node,
  ancestors: readonly ESTree.Node[],
  analysis: AvailabilityAnalysis,
  isAccess: (node: unknown) => boolean,
  allowsDirectAccessGuard: (node: unknown) => boolean,
  isPropertyExistenceTest: (property: string, object: ESTree.Node) => boolean,
  cacheKey: string | undefined,
): boolean {
  if (parent.type !== "Program" && parent.type !== "BlockStatement") return false;
  const body = (parent as ESTree.Program | ESTree.BlockStatement).body;
  const guardProves = (statement: ESTree.Node): boolean => {
    if (statement.type !== "IfStatement") return false;
    const guard = statement as ESTree.IfStatement;
    return Boolean(
      (alwaysExits(guard.consequent) &&
        guardProvesAvailability(
          guard.test,
          false,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        )) ||
      (alwaysExits(guard.alternate) &&
        guardProvesAvailability(
          guard.test,
          true,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        )),
    );
  };

  if (cacheKey) {
    let byBlock = guardIndexBySource.get(source);
    if (!byBlock) {
      byBlock = new WeakMap();
      guardIndexBySource.set(source, byBlock);
    }
    let byKey = byBlock.get(parent);
    if (!byKey) {
      byKey = new Map();
      byBlock.set(parent, byKey);
    }
    let index = byKey.get(cacheKey);
    if (!index) {
      const statementIndices = new WeakMap<object, number>();
      const latestGuardBefore: Array<number | null> = [null];
      for (let position = 0; position < body.length; position += 1) {
        const statement = body[position]!;
        statementIndices.set(statement, position);
        latestGuardBefore.push(guardProves(statement) ? position : latestGuardBefore[position]!);
      }
      index = { statementIndices, latestGuardBefore };
      byKey.set(cacheKey, index);
    }
    const directIndex = index.statementIndices.get(child);
    const childIndex = directIndex ?? body.findIndex((statement) => sameNode(statement, child));
    const guardIndex = childIndex > 0 ? index.latestGuardBefore[childIndex] : null;
    if (guardIndex === null || guardIndex === undefined) return false;
    const intervening = body.slice(guardIndex + 1, childIndex);
    return (
      !intervening.some((statement) => containsAccessInvalidation(statement, isAccess)) &&
      !hasInvalidationOnPath(child, target, ancestors, isAccess)
    );
  }

  const childIndex = body.findIndex((statement) => sameNode(statement, child));
  if (childIndex <= 0) return false;
  for (let index = childIndex - 1; index >= Math.max(0, childIndex - 64); index -= 1) {
    const previous = body[index];
    if (!previous || !guardProves(previous)) continue;
    const intervening = body.slice(index + 1, childIndex);
    return (
      !intervening.some((statement) => containsAccessInvalidation(statement, isAccess)) &&
      !hasInvalidationOnPath(child, target, ancestors, isAccess)
    );
  }
  return false;
}

/** Return true when a structurally dominating check proves an access safe. */
export function isAvailabilityGuarded(
  context: Context,
  target: ESTree.Node,
  analysis: AvailabilityAnalysis,
  isAccess: (node: unknown) => boolean,
  options: AvailabilityGuardOptions = {},
): boolean {
  if (
    (target.type === "CallExpression" || target.type === "NewExpression") &&
    options.isOptionalInvocation?.(target as Invocation)
  ) {
    return true;
  }
  const directGuardOption = options.allowDirectAccessGuard ?? true;
  const allowsDirectAccessGuard =
    typeof directGuardOption === "function" ? directGuardOption : () => directGuardOption;
  const isPropertyExistenceTest = options.isPropertyExistenceTest ?? (() => false);
  const ancestors = getAncestors(context, target);
  const source = context.sourceCode as unknown as object;
  const guardRemainsValid = (root: ESTree.Node): boolean =>
    !hasInvalidationOnPath(root, target, ancestors, isAccess);
  let child: ESTree.Node = target;
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const parent = ancestors[index]!;
    if (isFunctionBoundary(parent)) return false;
    if (parent.type === "LogicalExpression") {
      const logical = parent as ESTree.LogicalExpression;
      if (
        sameNode(logical.right, child) &&
        ((logical.operator === "&&" &&
          guardProvesAvailability(
            logical.left,
            true,
            analysis,
            isAccess,
            allowsDirectAccessGuard,
            isPropertyExistenceTest,
          )) ||
          (logical.operator === "||" &&
            guardProvesAvailability(
              logical.left,
              false,
              analysis,
              isAccess,
              allowsDirectAccessGuard,
              isPropertyExistenceTest,
            ))) &&
        guardRemainsValid(logical.right)
      ) {
        return true;
      }
    } else if (parent.type === "ConditionalExpression") {
      const conditional = parent as ESTree.ConditionalExpression;
      if (
        (sameNode(conditional.consequent, child) &&
          guardProvesAvailability(
            conditional.test,
            true,
            analysis,
            isAccess,
            allowsDirectAccessGuard,
            isPropertyExistenceTest,
          ) &&
          guardRemainsValid(conditional.consequent)) ||
        (sameNode(conditional.alternate, child) &&
          guardProvesAvailability(
            conditional.test,
            false,
            analysis,
            isAccess,
            allowsDirectAccessGuard,
            isPropertyExistenceTest,
          ) &&
          guardRemainsValid(conditional.alternate))
      ) {
        return true;
      }
    } else if (parent.type === "IfStatement") {
      const statement = parent as ESTree.IfStatement;
      if (
        (sameNode(statement.consequent, child) &&
          guardProvesAvailability(
            statement.test,
            true,
            analysis,
            isAccess,
            allowsDirectAccessGuard,
            isPropertyExistenceTest,
          ) &&
          guardRemainsValid(statement.consequent)) ||
        (sameNode(statement.alternate, child) &&
          guardProvesAvailability(
            statement.test,
            false,
            analysis,
            isAccess,
            allowsDirectAccessGuard,
            isPropertyExistenceTest,
          ) &&
          statement.alternate !== null &&
          guardRemainsValid(statement.alternate))
      ) {
        return true;
      }
    } else if (parent.type === "WhileStatement") {
      const statement = parent as ESTree.WhileStatement;
      if (
        sameNode(statement.body, child) &&
        guardProvesAvailability(
          statement.test,
          true,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        ) &&
        guardRemainsValid(statement.body)
      ) {
        return true;
      }
    } else if (parent.type === "ForStatement") {
      const statement = parent as ESTree.ForStatement;
      const bodyInvalidatesUpdate =
        sameNode(statement.update, child) && containsAccessInvalidation(statement.body, isAccess);
      if (
        statement.test &&
        (sameNode(statement.body, child) || sameNode(statement.update, child)) &&
        !bodyInvalidatesUpdate &&
        guardProvesAvailability(
          statement.test,
          true,
          analysis,
          isAccess,
          allowsDirectAccessGuard,
          isPropertyExistenceTest,
        ) &&
        guardRemainsValid(child)
      ) {
        return true;
      }
    }
    if (
      precedingExitGuard(
        source,
        parent,
        child,
        target,
        ancestors,
        analysis,
        isAccess,
        allowsDirectAccessGuard,
        isPropertyExistenceTest,
        options.guardCacheKey,
      )
    ) {
      return true;
    }
    child = parent;
  }
  return false;
}

/**
 * Return true only when a structurally dominating feature-availability check
 * proves the invocation cannot execute while the feature is absent.
 */
export function isInvocationAvailabilityGuarded(
  context: Context,
  invocation: Invocation,
  analysis: AvailabilityAnalysis,
  isAccess: (node: unknown) => boolean,
  options: AvailabilityGuardOptions = {},
): boolean {
  return isAvailabilityGuarded(context, invocation, analysis, isAccess, options);
}
