import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFile } from "../src/utils/filenames.js";

describe("classifyFile", () => {
  it("classifies Fluent metadata", () => {
    assert.equal(classifyFile("src/fluent/incident.now.ts", "", {}), "fluent");
  });

  it("classifies UI Actions before client heuristics", () => {
    assert.equal(
      classifyFile("src/ui-actions/close.ui-action.js", "g_form.setValue('x', 1);", {}),
      "ui-action",
    );
  });

  it("classifies client scripts from filename or g_form", () => {
    assert.equal(classifyFile("incident.client.js", "", {}), "client");
    assert.equal(classifyFile("misc.js", "g_form.setValue('x', 1);", {}), "client");
  });

  it("classifies business rules", () => {
    assert.equal(classifyFile("incident.br.js", "", {}), "business-rule");
  });

  it("honours settings.scriptType", () => {
    assert.equal(classifyFile("misc.js", "", { scriptType: "server" }), "server");
  });
});
