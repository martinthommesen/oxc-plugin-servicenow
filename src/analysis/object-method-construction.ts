import type { ESTree } from "@oxlint/plugins";
import { isNode, isValueReference, propertyKeyName, unwrapExpression, walk } from "../utils/ast.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import type { FileBindings } from "./bindings.js";
import { resolveDominatingConstValue, staticPropertyName } from "./members.js";

export interface ObjectMethodConstruction {
  readonly method: string;
  readonly node: ESTree.NewExpression;
}

interface Candidate {
  readonly method: string;
  readonly node: ESTree.NewExpression;
}

interface ObjectRecord {
  readonly allowedReferences: WeakSet<ESTree.Node>;
  readonly candidates: Candidate[];
  safe: boolean;
}

/** Resolve a same-execution const alias chain and reject any written alias. */
function stableAliasTerminal(
  node: unknown,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
): ESTree.Node | null {
  const terminal = resolveDominatingConstValue(node, bindings);
  if (!terminal) return null;

  let current = unwrapExpression(node);
  const seen = new Set<number>();
  while (current !== terminal) {
    if (!isNode(current) || current.type !== "Identifier") return null;
    const binding = bindings.resolve(current.name, current);
    if (
      binding?.kind !== "const" ||
      binding.node.type !== "VariableDeclarator" ||
      binding.declarations.length !== 1 ||
      bindingWrites.isWritten(binding.id) ||
      seen.has(binding.id)
    ) {
      return null;
    }
    const declaration = binding.node as ESTree.VariableDeclarator;
    if (declaration.id.type !== "Identifier" || !declaration.init) return null;
    seen.add(binding.id);
    current = unwrapExpression(declaration.init);
  }
  return terminal;
}

/** Return the final statically selected shorthand method in an object literal. */
function finalObjectMethod(object: ESTree.ObjectExpression, name: string): ESTree.Node | null {
  let method: ESTree.Node | null = null;
  for (const item of object.properties) {
    if (item.type === "SpreadElement") {
      // A later exact property can make the result known again.
      method = null;
      continue;
    }
    const property = item as ESTree.ObjectProperty;
    const propertyName = propertyKeyName(property);
    if (propertyName === null) {
      method = null;
      continue;
    }
    if (propertyName !== name) continue;
    method = property.kind === "init" && property.method ? property.value : null;
  }
  return method;
}

/**
 * Find `new` calls whose callee is proven to be shorthand object-method
 * syntax. Object aliases are accepted only when every value reference is part
 * of the proven constructor access or another immutable alias declaration.
 * This deliberately trades coverage for a very low false-positive rate when
 * an object may have escaped or had its property replaced.
 */
export function findObjectMethodConstructions(
  program: ESTree.Node,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
): readonly ObjectMethodConstruction[] {
  if (bindingWrites.hasDynamicScope()) return [];

  const records = new Map<ESTree.ObjectExpression, ObjectRecord>();
  walk(program, {
    NewExpression(node) {
      const construction = node as ESTree.NewExpression;
      const callee = stableAliasTerminal(construction.callee, bindings, bindingWrites);
      if (!callee || callee.type !== "MemberExpression") return;
      const member = callee as ESTree.MemberExpression;
      const method = staticPropertyName(member);
      if (!method) return;
      const object = resolveDominatingConstValue(member.object, bindings);
      if (!object || object.type !== "ObjectExpression") return;
      if (!finalObjectMethod(object, method)) return;

      let record = records.get(object);
      if (!record) {
        record = {
          allowedReferences: new WeakSet(),
          candidates: [],
          safe: true,
        };
        records.set(object, record);
      }
      const receiver = unwrapExpression(member.object);
      if (isNode(receiver) && receiver.type === "Identifier") {
        record.allowedReferences.add(receiver);
      }
      record.candidates.push({ method, node: construction });
    },
  });
  if (records.size === 0) return [];

  const recordByBinding = new Map<number, ObjectRecord>();
  walk(program, {
    VariableDeclarator(node) {
      const declaration = node as ESTree.VariableDeclarator;
      if (declaration.id.type !== "Identifier" || !declaration.init) return;
      const binding = bindings.resolve(declaration.id.name, declaration.id);
      if (
        binding?.kind !== "const" ||
        binding.node !== declaration ||
        binding.declarations.length !== 1 ||
        bindingWrites.isWritten(binding.id)
      ) {
        return;
      }
      const object = resolveDominatingConstValue(declaration.init, bindings);
      if (!object || object.type !== "ObjectExpression") return;
      const record = records.get(object);
      if (!record) return;
      const initializer = unwrapExpression(declaration.init);
      if (isNode(initializer) && initializer.type === "Identifier") {
        record.allowedReferences.add(initializer);
      } else if (initializer !== object) {
        // Conditional, sequence, and other computed aliases may run effects
        // between reads. They stay outside this deliberately narrow proof.
        return;
      }
      recordByBinding.set(binding.id, record);
    },
  });

  const ancestors: ESTree.Node[] = [];
  walk(
    program,
    {
      Identifier(node) {
        if (!isValueReference(node, ancestors)) return;
        const name = (node as { readonly name: string }).name;
        const binding = bindings.resolve(name, node, ancestors);
        const record = binding ? recordByBinding.get(binding.id) : undefined;
        if (record && !record.allowedReferences.has(node)) record.safe = false;
      },
    },
    ancestors,
  );

  return [...records.values()].flatMap((record) =>
    record.safe ? record.candidates.map(({ method, node }) => ({ method, node })) : [],
  );
}
