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

  it("bounds directory evidence to the project (FINDINGS.md COR-001)", () => {
    // Decoy segments above the project root must not assign a surface.
    assert.deepEqual(
      surfacesFromFilename("/home/alice/client/app/src/list.js", "/home/alice/client/app"),
      [],
    );
    assert.deepEqual(surfacesFromFilename("/opt/br/repo/src/thing.js", "/opt/br/repo"), []);
    assert.deepEqual(
      surfacesFromFilename(
        "C:\\Users\\dev\\client\\proj\\src\\list.js",
        "C:\\Users\\dev\\client\\proj",
      ),
      [],
    );
    // Decoys must not collapse basename evidence either.
    assert.deepEqual(
      surfacesFromFilename("/Users/bob/server/app/src/onload.client.js", "/Users/bob/server/app"),
      ["client"],
    );
    // Project-relative directory conventions keep working.
    assert.deepEqual(surfacesFromFilename("/proj/src/client/list.js", "/proj"), ["client"]);
    assert.deepEqual(surfacesFromFilename("/proj/br/rule.js", "/proj"), ["business-rule"]);
    assert.deepEqual(surfacesFromFilename("src/server/list.js"), ["server"]);
    // Absolute paths outside the project keep only basename evidence.
    assert.deepEqual(surfacesFromFilename("/elsewhere/client/x.js", "/proj"), []);
    assert.deepEqual(surfacesFromFilename("/elsewhere/x.client.js", "/proj"), ["client"]);
    assert.deepEqual(surfacesFromFilename("/home/alice/client/app/src/list.js"), []);
  });

  it("lets a Script Include filename beat a g_form mention in a comment", () => {
    assert.equal(classifyFile("util.si.js", "// mirrors g_form.setValue", {}), "script-include");
  });

  it("classifies Windows server paths", () => {
    assert.equal(classifyFile("src\\server\\thing.js", "", {}), "server");
  });
});
