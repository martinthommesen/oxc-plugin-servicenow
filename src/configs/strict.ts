import { PLUGIN_NAME } from "../constants.js";
import { strictRules } from "./maps.js";

export { strictRules };

export const strict = {
  name: `${PLUGIN_NAME}/strict`,
  rules: strictRules,
};
