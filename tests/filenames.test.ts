import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFile } from "../src/utils/filenames.js";
import { surfacesFromFilename } from "../src/context/filename.js";

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

  it("classifies a display Business Rule by filename, not g_scratchpad", () => {
    assert.equal(
      classifyFile("display-stuff.br.js", "g_scratchpad.count = 1;", {}),
      "business-rule",
    );
  });

  it("does not treat g_scratchpad alone as a client script", () => {
    assert.equal(classifyFile("misc.js", "g_scratchpad.x = 1;", {}), "unknown");
  });

  it("classifies ServiceNow client-script export filenames", () => {
    assert.equal(classifyFile("sys_script_client_onchange.js", "", {}), "client");
  });

  it("classifies sys_script.js as a Business Rule", () => {
    assert.equal(classifyFile("export/sys_script.js", "", {}), "business-rule");
    assert.deepEqual(surfacesFromFilename("export/sys_script2.js"), []);
  });

  it("rejects conflicting filename surface evidence", () => {
    assert.deepEqual(surfacesFromFilename("src/client/business-rule.js"), []);
    assert.deepEqual(surfacesFromFilename("close.client.ui-action.js"), ["ui-action", "client"]);
    assert.deepEqual(surfacesFromFilename("client-tools/thing.js"), []);
  });

  it("lets a Script Include filename beat a g_form mention in a comment", () => {
    assert.equal(classifyFile("util.si.js", "// mirrors g_form.setValue", {}), "script-include");
  });

  it("classifies Windows server paths", () => {
    assert.equal(classifyFile("src\\server\\thing.js", "", {}), "server");
  });

  it("prefers a specific subtype over a generic server directory", () => {
    assert.deepEqual(surfacesFromFilename("src/server/incident.br.js"), ["business-rule"]);
    assert.deepEqual(surfacesFromFilename("src/server/helper.si.js"), ["script-include"]);
  });
});
