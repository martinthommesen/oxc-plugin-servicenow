import type { Context, ESTree } from "@oxlint/plugins";
import { CLIENT_GLOBALS_STRONG } from "../constants.js";
import { resolveScriptContext } from "../context/resolve.js";
import { getValidatedSettingsResult } from "../settings/index.js";
import type { ServiceNowScriptContext, ValidatedServiceNowSettings } from "../types.js";
import { getName, isNode, isValueReference, walk } from "../utils/ast.js";
import { createFileBindings, type FileBindings } from "./bindings.js";
import { staticPropertyName } from "./members.js";
import { analyzePathBindings } from "./path-state.js";
import {
  ctorProvenanceKind,
  type Provenance,
  type ProvenanceKind,
  type ProvenanceQuery,
} from "./provenance.js";

export interface FileAnalysis {
  bindings: FileBindings;
  script: ServiceNowScriptContext;
  provenance: ProvenanceQuery;
}

const ALL_KINDS: readonly ProvenanceKind[] = [
  "GlideRecord",
  "GlideAggregate",
  "GlideAjax",
  "GlideDateTime",
];

const PLATFORM_ALIAS_KINDS = new Set<ProvenanceKind>(["g_form", "gs", "current"]);

const bySource = new WeakMap<object, Map<string, FileAnalysis>>();
let analysisPasses = 0;

export function getAnalysisPassCount(): number {
  return analysisPasses;
}

export function resetAnalysisPassCount(): void {
  analysisPasses = 0;
}

function settingsKey(settings: ValidatedServiceNowSettings): string {
  return JSON.stringify({
    authoring: settings.authoring,
    surfaces: settings.surfaces,
    javascriptMode: settings.javascriptMode,
    scriptType: settings.scriptType,
    fluentSdkVersion: settings.fluentSdkVersion,
    scope: settings.scope,
    businessRuleSourceFormat: settings.businessRuleSourceFormat,
    businessRuleWhen: settings.businessRuleWhen,
    ecmaLatest: settings.ecmaLatest,
    release: settings.release,
  });
}

function emptyProvenance(kind: ProvenanceKind, extras?: Partial<Provenance>): Provenance {
  return Object.freeze({
    kind,
    invalid: false,
    escaped: false,
    queryState: "unopened",
    windowed: false,
    sysparmName: false,
    aggregates: new Set<string>(),
    ...extras,
  });
}

function inferClientFromAst(program: ESTree.Node, bindings: FileBindings): boolean {
  const ancestors: ESTree.Node[] = [];
  let found = false;
  walk(
    program,
    {
      Identifier(node) {
        if (found) return;
        const name = getName(node);
        if (!name || !(CLIENT_GLOBALS_STRONG as readonly string[]).includes(name)) return;
        if (!isValueReference(node, ancestors)) return;
        if (bindings.isPlatformGlobal(node, ancestors)) found = true;
      },
    },
    ancestors,
  );
  return found;
}

function buildFileAnalysis(context: Context): FileAnalysis {
  analysisPasses += 1;
  const program = context.sourceCode.ast as ESTree.Node | undefined;
  const bindings = createFileBindings(context, program);
  const script = resolveScriptContext(context, {
    program,
    inferClient: program ? () => inferClientFromAst(program, bindings) : undefined,
  });

  const provenanceAtNode = new Map<ESTree.Node, Provenance>();
  const identifierAtNode = new Map<ESTree.Node, Provenance>();

  if (program) {
    const kindByObject = new Map<number, ProvenanceKind>();
    analyzePathBindings({
      program,
      analysis: makeQuery(bindings, provenanceAtNode, identifierAtNode),
      kinds: ALL_KINDS,
      emptyData: () => ({}),
      cloneData: () => ({}),
      mergeData: () => ({}),
      onCall() {},
      onRef({ node, rec, bindingId }) {
        if (!rec) return;
        if (node.type === "NewExpression") {
          const kind = ctorProvenanceKind(getName((node as ESTree.NewExpression).callee));
          if (kind) kindByObject.set(rec.id, kind);
        }
        if (node.type === "Identifier") {
          const name = getName(node);
          if (name && PLATFORM_ALIAS_KINDS.has(name as ProvenanceKind) && !bindingId) {
            kindByObject.set(rec.id, name as ProvenanceKind);
          }
        }
        const kind = kindByObject.get(rec.id);
        if (!kind) return;
        const snap = emptyProvenance(kind, {
          invalid: rec.invalid,
          escaped: rec.escaped,
          bindingId: bindingId ?? undefined,
          objectId: rec.id,
        });
        if (node.type === "Identifier") identifierAtNode.set(node, snap);
        provenanceAtNode.set(node, snap);
      },
    });

    const ancestors: ESTree.Node[] = [];
    walk(
      program,
      {
        Identifier(node) {
          if (identifierAtNode.has(node)) return;
          const name = getName(node);
          if (!name || !PLATFORM_ALIAS_KINDS.has(name as ProvenanceKind)) return;
          if (!isValueReference(node, ancestors)) return;
          if (!bindings.isPlatformGlobal(node, ancestors)) return;
          const snap = emptyProvenance(name as ProvenanceKind);
          identifierAtNode.set(node, snap);
        },
        NewExpression(node) {
          if (provenanceAtNode.has(node)) return;
          const ctor = getName((node as ESTree.NewExpression).callee);
          const kind = ctorProvenanceKind(ctor);
          if (!kind) return;
          if (!bindings.isPlatformGlobal((node as ESTree.NewExpression).callee as ESTree.Node)) return;
          provenanceAtNode.set(node, emptyProvenance(kind, { objectId: undefined }));
        },
      },
      ancestors,
    );
  }

  return {
    bindings,
    script,
    provenance: makeQuery(bindings, provenanceAtNode, identifierAtNode),
  };
}

function makeQuery(
  bindings: FileBindings,
  provenanceAtNode: Map<ESTree.Node, Provenance>,
  identifierAtNode: Map<ESTree.Node, Provenance>,
): ProvenanceQuery {
  return {
    bindings,
    ofIdentifier(node) {
      return identifierAtNode.get(node) ?? null;
    },
    ofExpression(node) {
      if (!isNode(node)) return null;
      return provenanceAtNode.get(node) ?? identifierAtNode.get(node) ?? null;
    },
    isPlatformGlobal(node) {
      return bindings.isPlatformGlobal(node);
    },
    isPlatformCtor(node, names) {
      const name = getName(node);
      if (!name || !names.includes(name)) return false;
      if (!isNode(node)) return false;
      return bindings.isPlatformGlobal(node);
    },
    isPlatformMember(node, object, property) {
      if (!isNode(node) || node.type !== "MemberExpression") return false;
      const member = node as unknown as ESTree.MemberExpression;
      const objectNode = member.object as ESTree.Node;
      const direct = getName(objectNode) === object && bindings.isPlatformGlobal(objectNode);
      const proven = provenanceAtNode.get(objectNode) ?? identifierAtNode.get(objectNode);
      const aliased =
        proven !== undefined && proven.kind === object && !proven.invalid && !proven.escaped;
      if (!direct && !aliased) return false;
      if (property === undefined) return true;
      return staticPropertyName(member) === property;
    },
  };
}

/**
 * Shared per-file analysis. Cache identity includes the host SourceCode object
 * and every setting that can change semantics.
 */
export function getFileAnalysis(context: Context): FileAnalysis {
  const source = context.sourceCode as object;
  let bucket = bySource.get(source);
  if (!bucket) {
    bucket = new Map();
    bySource.set(source, bucket);
  }
  const key = settingsKey(getValidatedSettingsResult(context).settings);
  const hit = bucket.get(key);
  if (hit) return hit;
  const created = buildFileAnalysis(context);
  bucket.set(key, created);
  return created;
}

export function getScriptContext(context: Context): ServiceNowScriptContext {
  return getFileAnalysis(context).script;
}

export function analyzeProvenance(context: Context, _ast?: ESTree.Node): ProvenanceQuery {
  return getFileAnalysis(context).provenance;
}
