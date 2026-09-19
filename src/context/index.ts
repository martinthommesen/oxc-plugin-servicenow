export {
  appliesOnSurface,
  appliesToInstanceScripts,
  isClientCapableContext,
  isFluentContext,
  isInstanceScript,
  isMixedUiActionContext,
  isServerInstanceContext,
  resolveScriptContext,
  CONTEXT_CONFIDENCE_ORDER,
} from "./resolve.js";
export { getScriptContext } from "../analysis/file-analysis.js";
export {
  basename,
  isFluentFile,
  looksLikeClientSource,
  normalizeFilename,
  surfacesFromFilename,
} from "./filename.js";
