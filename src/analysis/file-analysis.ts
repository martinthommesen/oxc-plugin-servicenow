import type { Context, ESTree } from "@oxlint/plugins";
import { CLIENT_GLOBALS_STRONG } from "../constants.js";
import { resolveScriptContext } from "../context/resolve.js";
import { fingerprintServiceNowSettings, getValidatedSettingsResult } from "../settings/index.js";
import type { ServiceNowScriptContext } from "../types.js";
import { getName, isNode, isValueReference, walk } from "../utils/ast.js";
import { createFileBindings, type FileBindings } from "./bindings.js";
import { resolvePlatformGlobalName } from "./globals.js";
import { resolveConstValue, staticPropertyName } from "./members.js";
import { analyzePathBindings, shallowClone } from "./path-state.js";
import {
  CONSTRUCTED_PROVENANCE_KINDS,
  ctorProvenanceKind,
  isPlatformAliasGlobal,
  type Provenance,
  type ProvenanceKind,
  type ProvenanceQuery,
} from "./provenance.js";
import { resolveFluentManifest, type FluentSdkManifest } from "../fluent/index.js";
import type { FluentApiCapability } from "../fluent/index.js";
import { resolveGlideCapabilities, type GlideCapabilityView } from "../glide/index.js";
import {
  collectFluentImports,
  resolveFluentFactory,
  type FluentImportBinding,
} from "./fluent-imports.js";
import {
  isCanonicalNow,
  mergeNowIdFacts,
  nowIdFactsEqual,
  nowIdValue,
  type NowIdFact,
} from "./now-id.js";
import { createMutationQuery, type MutationQuery } from "./mutations.js";
import { createBindingWriteQuery, type BindingWriteQuery } from "./binding-writes.js";
import { createBindingReferenceQuery, type BindingReferenceQuery } from "./binding-references.js";

export interface FluentFileFacts {
  manifest: FluentSdkManifest;
  imports: ReadonlyMap<number, FluentImportBinding>;
  resolveFactory(callee: unknown, ancestors?: readonly ESTree.Node[]): FluentApiCapability | null;
  isCanonicalNow(node: ESTree.Node): boolean;
}

export interface FileAnalysis {
  bindings: FileBindings;
  /** Lazily indexed lexical writes and dynamic-scope hazards shared by rule analyses. */
  bindingWrites: BindingWriteQuery;
  /** Lazily indexed identifier references and declarators per binding (FINDINGS.md PER-005). */
  bindingReferences: BindingReferenceQuery;
  script: ServiceNowScriptContext;
  provenance: ProvenanceQuery;
  /** GlideRecord and GlideAggregate capabilities for the configured scope and release. */
  glide: GlideCapabilityView;
  /** Lazily indexed possible writes used to suppress diagnostics when API identity is uncertain. */
  mutations: MutationQuery;
  /** Browser-runtime mutation semantics for client API authority checks. */
  browserMutations: MutationQuery;
  fluent: FluentFileFacts;
  /** Program-point `Now.ID` facts keyed by the use-site node. */
  nowIdAt: ReadonlyMap<ESTree.Node, NowIdFact>;
  /**
   * True when path analysis exceeded its work budget and provenance was
   * cleared to fail safe. Rules stay silent on such files; the flag keeps
   * the degraded state observable instead of indistinguishable from clean
   * (FINDINGS.md PER-006).
   */
  pathBudgetExhausted: boolean;
}

interface FilePathData {
  nowIdKey: NowIdFact;
}

type AnalysisTree =
  | { kind: "host"; program: ESTree.Node | undefined }
  | { kind: "explicit"; program: ESTree.Node };

const bySource = new WeakMap<object, Map<string, FileAnalysis>>();
const bySourceAndAst = new WeakMap<object, WeakMap<ESTree.Node, Map<string, FileAnalysis>>>();
let analysisPasses = 0;

export function getAnalysisPassCount(): number {
  return analysisPasses;
}

export function resetAnalysisPassCount(): void {
  analysisPasses = 0;
}

function emptyProvenance(kind: ProvenanceKind, extras?: Partial<Provenance>): Provenance {
  return Object.freeze({
    kind,
    invalid: false,
    escaped: false,
    ...extras,
  });
}

const SERVER_GLOBALS = new Set(["current", "previous"]);

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

function buildFileAnalysis(context: Context, tree: AnalysisTree): FileAnalysis {
  analysisPasses += 1;
  const { program } = tree;
  const bindings = createFileBindings(context, program, {
    scopeSource: tree.kind === "host" ? "host" : "tree",
  });
  const bindingWrites = createBindingWriteQuery(program, bindings);
  const bindingReferences = createBindingReferenceQuery(program, bindings);
  const script = resolveScriptContext(context, {
    inferSurfaces: program ? () => inferSurfacesFromAst(program, bindings) : undefined,
  });
  const settings = getValidatedSettingsResult(context).settings;
  const glide = resolveGlideCapabilities({ scope: settings.scope, release: settings.release });

  const provenanceAtNode = new Map<ESTree.Node, Provenance>();
  const identifierAtNode = new Map<ESTree.Node, Provenance>();
  const nowIdAt = new Map<ESTree.Node, NowIdFact>();
  let pathBudgetExhausted = false;

  const provenance = makeQuery(bindings, provenanceAtNode, identifierAtNode, glide);

  if (program) {
    const kindByObject = new Map<number, ProvenanceKind>();
    const pathOutcome = analyzePathBindings<FilePathData>({
      program,
      analysis: provenance,
      kinds: CONSTRUCTED_PROVENANCE_KINDS,
      emptyData: () => ({ nowIdKey: null }),
      cloneData: shallowClone,
      equalsData: (left, right) => nowIdFactsEqual(left.nowIdKey, right.nowIdKey),
      mergeData: (left, right) => ({
        nowIdKey: mergeNowIdFacts(left.nowIdKey, right.nowIdKey),
      }),
      mergeDistinctData: (left, right) => {
        if (left.nowIdKey === null || right.nowIdKey === null) return undefined;
        return { nowIdKey: mergeNowIdFacts(left.nowIdKey, right.nowIdKey) };
      },
      onValue(node) {
        const key = nowIdValue(node, provenance);
        if (key === undefined) return undefined;
        return { nowIdKey: key };
      },
      onRef({ node, rec, bindingId }) {
        if (rec?.data.nowIdKey != null) nowIdAt.set(node, rec.data.nowIdKey);
        if (!rec) return;
        if (node.type === "NewExpression") {
          const callee = resolveConstValue((node as ESTree.NewExpression).callee, bindings);
          const kind = ctorProvenanceKind(resolvePlatformGlobalName(callee, bindings));
          if (kind) kindByObject.set(rec.id, kind);
        }
        if (node.type === "Identifier") {
          const name = getName(node);
          if (name && isPlatformAliasGlobal(name) && !bindingId) {
            kindByObject.set(rec.id, name);
          }
        }
        const kind = kindByObject.get(rec.id);
        if (!kind) return;
        const snap = emptyProvenance(kind, {
          invalid: rec.invalid,
          escaped: rec.escaped,
          ...(bindingId == null ? {} : { bindingId }),
          objectId: rec.id,
        });
        if (node.type === "Identifier") identifierAtNode.set(node, snap);
        provenanceAtNode.set(node, snap);
      },
    });
    if (pathOutcome.outcome === "exhausted") {
      provenanceAtNode.clear();
      identifierAtNode.clear();
      nowIdAt.clear();
      pathBudgetExhausted = true;
    }

    const ancestors: ESTree.Node[] = [];
    walk(
      program,
      {
        Identifier(node) {
          if (identifierAtNode.has(node)) return;
          const name = getName(node);
          if (!name || !isPlatformAliasGlobal(name)) return;
          if (!isValueReference(node, ancestors)) return;
          if (!bindings.isPlatformGlobal(node, ancestors)) return;
          identifierAtNode.set(node, emptyProvenance(name));
        },
        NewExpression(node) {
          if (provenanceAtNode.has(node)) return;
          const ctor = getName((node as ESTree.NewExpression).callee);
          const kind = ctorProvenanceKind(ctor);
          if (!kind) return;
          if (!bindings.isPlatformGlobal((node as ESTree.NewExpression).callee as ESTree.Node))
            return;
          provenanceAtNode.set(node, emptyProvenance(kind));
        },
      },
      ancestors,
    );
  }

  const mutations = createMutationQuery(
    program,
    bindings,
    bindingWrites,
    provenance,
    script.javascriptMode,
  );
  const browserMutations = createMutationQuery(
    program,
    bindings,
    bindingWrites,
    provenance,
    script.javascriptMode,
    "browser",
  );
  const manifest = resolveFluentManifest(settings.fluentSdkVersion);
  const imports = program ? collectFluentImports(program, bindings) : new Map();

  return {
    bindings,
    bindingWrites,
    bindingReferences,
    script,
    provenance,
    glide,
    mutations,
    browserMutations,
    nowIdAt,
    pathBudgetExhausted,
    fluent: {
      manifest,
      imports,
      resolveFactory(callee, ancestors = []) {
        return resolveFluentFactory(callee, ancestors, bindings, imports, manifest, bindingWrites);
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
  glide: GlideCapabilityView,
): ProvenanceQuery {
  return {
    bindings,
    glide,
    ofIdentifier(node) {
      return identifierAtNode.get(node) ?? null;
    },
    ofExpression(node) {
      if (!isNode(node)) return null;
      return provenanceAtNode.get(node) ?? identifierAtNode.get(node) ?? null;
    },
    trustedExpression(node) {
      if (!isNode(node)) return null;
      const provenance = provenanceAtNode.get(node) ?? identifierAtNode.get(node);
      return provenance && !provenance.invalid && !provenance.escaped ? provenance : null;
    },
    isPlatformGlobal(node) {
      return bindings.isPlatformGlobal(node);
    },
    isPlatformCtor(node, names) {
      const name = resolvePlatformGlobalName(node, bindings);
      return name !== null && names.includes(name);
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
 * Every input that can differ between two analyses of the same `SourceCode`.
 * The default Fluent SDK version, the Glide release list, and the resolver
 * version are module constants, and both cache stores are process-local, so
 * they cannot vary within one process and are not part of the identity.
 */
interface AnalysisCacheIdentity {
  readonly filename: string;
  readonly physicalFilename: string;
  readonly cwd: string;
  readonly settingsFingerprint: string;
}

function analysisCacheIdentity(context: Context): AnalysisCacheIdentity {
  const settings = getValidatedSettingsResult(context).settings;
  const host = context as Context & { physicalFilename?: string; cwd?: string };
  return {
    filename: context.filename,
    physicalFilename: host.physicalFilename ?? "",
    cwd: host.cwd ?? "",
    settingsFingerprint: fingerprintServiceNowSettings(settings),
  };
}

function getOrCreate<K extends object, V>(store: WeakMap<K, V>, key: K, make: () => V): V {
  const existing = store.get(key);
  if (existing) return existing;
  const created = make();
  store.set(key, created);
  return created;
}

function lookupFileAnalysis(context: Context, ast?: ESTree.Node): FileAnalysis {
  const source = context.sourceCode as object;
  const hostAst = context.sourceCode.ast as ESTree.Node | undefined;
  const explicitAst = ast !== undefined && ast !== hostAst ? ast : undefined;
  const bucket = explicitAst
    ? getOrCreate(
        getOrCreate(
          bySourceAndAst,
          source,
          () => new WeakMap<ESTree.Node, Map<string, FileAnalysis>>(),
        ),
        explicitAst,
        () => new Map<string, FileAnalysis>(),
      )
    : getOrCreate(bySource, source, () => new Map<string, FileAnalysis>());

  const key = JSON.stringify(analysisCacheIdentity(context));
  const hit = bucket.get(key);
  if (hit) return hit;
  const created = buildFileAnalysis(
    context,
    explicitAst ? { kind: "explicit", program: explicitAst } : { kind: "host", program: hostAst },
  );
  bucket.set(key, created);
  return created;
}

/**
 * Shared per-file analysis. Cache identity includes the host SourceCode object
 * and every setting that can change semantics.
 */
export function getFileAnalysis(context: Context): FileAnalysis {
  return lookupFileAnalysis(context);
}

export function getScriptContext(context: Context): ServiceNowScriptContext {
  return getFileAnalysis(context).script;
}

export function analyzeProvenance(context: Context, ast?: ESTree.Node): ProvenanceQuery {
  return lookupFileAnalysis(context, ast).provenance;
}
