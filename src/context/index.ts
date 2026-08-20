export {
  appliesInJavaScriptModes,
  appliesOnSurface,
  appliesToInstanceScripts,
  hasSurface,
  isClientCapableContext,
  isFluentContext,
  isInstanceScript,
  isServerInstanceContext,
  javascriptModeIs,
  resolveScriptContext,
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
