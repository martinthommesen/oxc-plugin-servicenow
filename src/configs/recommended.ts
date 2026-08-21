import { PLUGIN_NAME } from "../constants.js";
import { recommendedRules } from "./maps.js";

export { recommendedRules };

export const recommended = {
  name: `${PLUGIN_NAME}/recommended`,
  rules: recommendedRules,
};
