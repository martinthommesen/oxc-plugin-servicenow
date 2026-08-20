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
import { resolveFluentManifest, type FluentSdkManifest } from "../fluent/index.js";
import type { FluentApiCapability } from "../fluent/index.js";
import {
  collectFluentImports,
  resolveFluentFactory,
  type FluentImportBinding,
} from "./fluent-imports.js";
import { isCanonicalNow, mergeNowIdFacts, nowIdValue, type NowIdFact } from "./now-id.js";

export interface FluentFileFacts {
  manifest: FluentSdkManifest;
  imports: ReadonlyMap<number, FluentImportBinding>;
  resolveFactory(callee: unknown, ancestors?: readonly ESTree.Node[]): FluentApiCapability | null;
  isCanonicalNow(node: ESTree.Node): boolean;
}

export interface FileAnalysis {
  bindings: FileBindings;
  script: ServiceNowScriptContext;
  provenance: ProvenanceQuery;
  fluent: FluentFileFacts;
  /** Program-point `Now.ID` facts keyed by the use-site node. */
  nowIdAt: ReadonlyMap<ESTree.Node, NowIdFact>;
}

interface FilePathData {
  nowIdKey: NowIdFact;
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
    allowedSysIds: settings.allowedSysIds,
    allowedTables: settings.allowedTables,
    scopePrefix: settings.scopePrefix,
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

const SERVER_GLOBALS = new Set([
  "gs",
  "current",
  "previous",
]);

function inferSurfacesFromAst(
  program: ESTree.Node,
  bindings: FileBindings,
): { client: boolean; server: boolean } {
  const ancestors: ESTree.Node[] = [];
  const found = { client: false, server: false };
  walk(
    program,
    {
      Identifier(node) {
        const name = getName(node);
        if (!name || !isValueReference(node, ancestors)) return;
        if (!bindings.isPlatformGlobal(node, ancestors)) return;
        if ((CLIENT_GLOBALS_STRONG as readonly string[]).includes(name)) found.client = true;
        if (SERVER_GLOBALS.has(name)) found.server = true;
      },
    },
    ancestors,
  );
  return found;
}

function inferClientFromAst(program: ESTree.Node, bindings: FileBindings): boolean {
  return inferSurfacesFromAst(program, bindings).client;
}

function buildFileAnalysis(context: Context): FileAnalysis {
  analysisPasses += 1;
  const program = context.sourceCode.ast as ESTree.Node | undefined;
  const bindings = createFileBindings(context, program);
  const script = resolveScriptContext(context, {
    program,
    inferClient: program ? () => inferClientFromAst(program, bindings) : undefined,
    inferSurfaces: program ? () => inferSurfacesFromAst(program, bindings) : undefined,
  });

  const provenanceAtNode = new Map<ESTree.Node, Provenance>();
  const identifierAtNode = new Map<ESTree.Node, Provenance>();
  const nowIdAt = new Map<ESTree.Node, NowIdFact>();

  if (program) {
    const kindByObject = new Map<number, ProvenanceKind>();
    const query = makeQuery(bindings, provenanceAtNode, identifierAtNode);
    analyzePathBindings<FilePathData>({
      program,
      analysis: query,
      kinds: ALL_KINDS,
      emptyData: () => ({ nowIdKey: null }),
      cloneData: (data) => ({ ...data }),
      mergeData: (left, right) => ({
        nowIdKey: mergeNowIdFacts(left.nowIdKey, right.nowIdKey),
      }),
      onCall() {},
      onValue(node) {
        const key = nowIdValue(node, query);
        if (key === undefined) return undefined;
        return { nowIdKey: key };
      },
      onRef({ node, rec, bindingId }) {
        if (rec?.data.nowIdKey != null) nowIdAt.set(node, rec.data.nowIdKey);
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

  const provenance = makeQuery(bindings, provenanceAtNode, identifierAtNode);
  const settings = getValidatedSettingsResult(context).settings;
  const manifest = resolveFluentManifest(settings.fluentSdkVersion);
  const imports = program ? collectFluentImports(program, bindings) : new Map();

  return {
    bindings,
    script,
    provenance,
    nowIdAt,
    fluent: {
      manifest,
      imports,
      resolveFactory(callee, ancestors = []) {
        return resolveFluentFactory(callee, ancestors, bindings, imports, manifest);
      },
      isCanonicalNow(node) {
        return isCanonicalNow(node, provenance);
      },
    },
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
