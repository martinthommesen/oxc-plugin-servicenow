export {
  appliesInJavaScriptModes,
  appliesOnSurface,
  appliesToInstanceScripts,
  hasSurface,
  isClientCapableContext,
  isFluentContext,
  isInstanceScript,
  isMixedUiActionContext,
  isServerInstanceContext,
  javascriptModeIs,
  resolveScriptContext,
  CONTEXT_CONFIDENCE_ORDER,
} from "./resolve.js";
export { getScriptContext } from "../analysis/file-analysis.js";
export {
  basename,
  isFluentFile,
  looksLikeClientSource,
  normalizeFilename,
  SERVER_FILE,
  surfacesFromFilename,
} from "./filename.js";
