import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression, walk } from "../utils/ast.js";
import { forEachResolvedPatternBinding, type FileBindings } from "./bindings.js";

interface BindingWriteIndex {
  readonly dynamicScope: boolean;
  readonly written: ReadonlySet<number>;
}

export interface BindingWriteQuery {
  /** True when the lexical binding is assigned or updated outside its declaration. */
  isWritten(bindingId: number): boolean;
  /** True when direct global eval or with can invalidate lexical resolution. */
  hasDynamicScope(): boolean;
}

function buildIndex(program: ESTree.Node | undefined, bindings: FileBindings): BindingWriteIndex {
  const written = new Set<number>();
  if (!program) return { dynamicScope: false, written };

  const ancestors: ESTree.Node[] = [];
  let dynamicScope = false;
  const record = (target: unknown): void => {
    forEachResolvedPatternBinding(target, bindings, ancestors, (binding) => {
      written.add(binding.id);
    });
  };

  walk(
    program,
    {
      AssignmentExpression(node) {
        record((node as ESTree.AssignmentExpression).left);
      },
      UpdateExpression(node) {
        record((node as ESTree.UpdateExpression).argument);
      },
      ForInStatement(node) {
        record((node as ESTree.ForInStatement).left);
      },
      ForOfStatement(node) {
        record((node as ESTree.ForOfStatement).left);
      },
      WithStatement() {
        dynamicScope = true;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        if (
          !call.optional &&
          isNode(callee) &&
          callee.type === "Identifier" &&
          callee.name === "eval" &&
          bindings.isPlatformGlobal(callee, ancestors)
        ) {
          dynamicScope = true;
        }
      },
    },
    ancestors,
  );
  return { dynamicScope, written };
}

/** Create a lazy, immutable binding-write view shared by every rule for one file. */
export function createBindingWriteQuery(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
): BindingWriteQuery {
  let index: BindingWriteIndex | undefined;
  const getIndex = () => (index ??= buildIndex(program, bindings));
  return Object.freeze({
    isWritten(bindingId: number) {
      return getIndex().written.has(bindingId);
    },
    hasDynamicScope() {
      return getIndex().dynamicScope;
    },
  });
}
