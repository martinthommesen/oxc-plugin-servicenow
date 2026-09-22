import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, isValueReference, nodeStart, walk } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";

/** One value reference to a lexical binding, with the context a rule needs to classify it. */
export interface BindingReference {
  /** The referencing identifier. */
  readonly node: ESTree.Node;
  /** The identifier's parent node, or undefined at the program root. */
  readonly parent: ESTree.Node | undefined;
  /** Portable start offset of the identifier, or -1 when the host supplies none. */
  readonly start: number;
}

const NO_REFERENCES: readonly BindingReference[] = [];
const NO_DECLARATORS: readonly ESTree.VariableDeclarator[] = [];

/**
 * Per-file index of identifier references and declarators keyed by binding
 * id. Rules that need "every use of this binding" query it instead of walking
 * the program once per call site, which kept whole-file work proportional to
 * the number of counted loops (FINDINGS.md PER-005).
 */
export interface BindingReferenceQuery {
  /** Value references to the binding in program order; declaration ids are excluded. */
  referencesFor(bindingId: number): readonly BindingReference[];
  /** Declarators whose id is exactly this binding's identifier, in program order. */
  declaratorsFor(bindingId: number): readonly ESTree.VariableDeclarator[];
}

interface BindingReferenceIndex {
  readonly references: ReadonlyMap<number, readonly BindingReference[]>;
  readonly declarators: ReadonlyMap<number, readonly ESTree.VariableDeclarator[]>;
}

function buildIndex(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
): BindingReferenceIndex {
  const references = new Map<number, BindingReference[]>();
  const declarators = new Map<number, ESTree.VariableDeclarator[]>();
  if (!program) return { references, declarators };
  const ancestors: ESTree.Node[] = [];
  walk(
    program,
    {
      Identifier(node) {
        if (!isValueReference(node, ancestors)) return;
        const name = getName(node);
        const binding = name ? bindings.resolve(name, node, ancestors) : null;
        if (!binding) return;
        const entry: BindingReference = {
          node,
          parent: ancestors[ancestors.length - 2],
          start: nodeStart(node),
        };
        const entries = references.get(binding.id);
        if (entries) entries.push(entry);
        else references.set(binding.id, [entry]);
      },
      VariableDeclarator(node) {
        const declarator = node as ESTree.VariableDeclarator;
        if (!isNode(declarator.id) || declarator.id.type !== "Identifier") return;
        const binding = bindings.resolve(getName(declarator.id) ?? "", declarator.id, ancestors);
        if (!binding) return;
        const entries = declarators.get(binding.id);
        if (entries) entries.push(declarator);
        else declarators.set(binding.id, [declarator]);
      },
    },
    ancestors,
  );
  return { references, declarators };
}

/** Create a lazy, immutable reference index shared by every rule for one file. */
export function createBindingReferenceQuery(
  program: ESTree.Node | undefined,
  bindings: FileBindings,
): BindingReferenceQuery {
  let index: BindingReferenceIndex | undefined;
  const getIndex = () => (index ??= buildIndex(program, bindings));
  return Object.freeze({
    referencesFor(bindingId: number) {
      return getIndex().references.get(bindingId) ?? NO_REFERENCES;
    },
    declaratorsFor(bindingId: number) {
      return getIndex().declarators.get(bindingId) ?? NO_DECLARATORS;
    },
  });
}
