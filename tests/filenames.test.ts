import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authoringFromFilename, surfacesFromFilename } from "../src/context/filename.js";

// @lat: [[tests#Context evidence#Filename classification is deterministic]]
describe("surfacesFromFilename", () => {
  it("recognizes Fluent metadata as authoring, not a surface", () => {
    assert.equal(authoringFromFilename("src/fluent/incident.now.ts"), "fluent");
    assert.equal(authoringFromFilename("incident.br.js"), undefined);
  });

  it("keeps a UI Action bare rather than guessing a client surface", () => {
    assert.deepEqual(surfacesFromFilename("src/ui-actions/close.ui-action.js"), ["ui-action"]);
  });

  it("recognizes client scripts from the filename", () => {
    assert.deepEqual(surfacesFromFilename("incident.client.js"), ["client"]);
  });

  it("recognizes business rules", () => {
    assert.deepEqual(surfacesFromFilename("incident.br.js"), ["business-rule"]);
    assert.deepEqual(surfacesFromFilename("display-stuff.br.js"), ["business-rule"]);
  });

  it("returns no surface for a name that carries no evidence", () => {
    assert.deepEqual(surfacesFromFilename("misc.js"), []);
  });

  it("recognizes ServiceNow client-script export filenames", () => {
    assert.deepEqual(surfacesFromFilename("sys_script_client_onchange.js"), ["client"]);
  });

  it("classifies sys_script.js as a Business Rule", () => {
    assert.deepEqual(surfacesFromFilename("export/sys_script.js"), ["business-rule"]);
    assert.deepEqual(surfacesFromFilename("export/sys_script2.js"), []);
  });

  it("classifies ACL export names and directories without broad security guesses", () => {
    for (const filename of [
      "incident.acl.js",
      "incident.access-control.cjs",
      "read.access.control.js",
      "sys_security_acl_read.mjs",
      "src/access-controls/read.js",
      "src/access_control/read.cjs",
      "src/accesscontrol/read.mjs",
      "src/acl/write.js",
    ]) {
      assert.deepEqual(surfacesFromFilename(filename), ["acl"], filename);
    }
    for (const filename of ["accesscontroller.js", "sys_security_aclanything.js"]) {
      assert.deepEqual(surfacesFromFilename(filename), [], filename);
    }
    assert.deepEqual(surfacesFromFilename("src/security/helper.js"), []);
    assert.deepEqual(surfacesFromFilename("src/client/read.acl.js"), []);
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
    // A root base directory keeps every segment below it.
    assert.deepEqual(surfacesFromFilename("/src/client/list.js", "/"), ["client"]);
    assert.deepEqual(surfacesFromFilename("/proj/src/client/x.js", "/proj/"), ["client"]);
    // Absolute paths outside the project keep only basename evidence.
    assert.deepEqual(surfacesFromFilename("/elsewhere/client/x.js", "/proj"), []);
    assert.deepEqual(surfacesFromFilename("/elsewhere/x.client.js", "/proj"), ["client"]);
    assert.deepEqual(surfacesFromFilename("/home/alice/client/app/src/list.js"), []);
  });

  it("recognizes Script Include filenames", () => {
    assert.deepEqual(surfacesFromFilename("util.si.js"), ["script-include"]);
  });

  it("classifies Windows server paths", () => {
    assert.deepEqual(surfacesFromFilename("src\\server\\thing.js"), ["server"]);
  });

  it("prefers a specific subtype over a generic server directory", () => {
    assert.deepEqual(surfacesFromFilename("src/server/incident.br.js"), ["business-rule"]);
    assert.deepEqual(surfacesFromFilename("src/server/helper.si.js"), ["script-include"]);
    assert.deepEqual(surfacesFromFilename("src/server/read.acl.js"), ["acl"]);
    assert.deepEqual(surfacesFromFilename("src/server/nightly.ss.js"), ["scheduled-script"]);
    assert.deepEqual(surfacesFromFilename("src/server/repair.fix.js"), ["fix-script"]);
  });

  it("keeps server evidence on a UI Action (FINDINGS.md COR-017)", () => {
    // The UI Action subtype names a record type, not an execution surface, so
    // the documented compound suffix composes instead of displacing `server`.
    for (const filename of [
      "approve.server.ui-action.js",
      "approve.server.ui-action.cjs",
      "approve.server.ui-action.mjs",
      "approve.server.ui_action.js",
      "approve.server.ua.js",
      "approve.ui-action.server.js",
    ]) {
      assert.deepEqual(surfacesFromFilename(filename), ["ui-action", "server"], filename);
    }
    for (const filename of [
      "src/server/approve.ui-action.js",
      "server/approve.ui_action.cjs",
      "src/server/ui-actions/approve.mjs",
      "src\\server\\approve.ui-action.js",
    ]) {
      assert.deepEqual(surfacesFromFilename(filename), ["ui-action", "server"], filename);
    }
    assert.deepEqual(surfacesFromFilename("/proj/src/server/approve.ui-action.js", "/proj"), [
      "ui-action",
      "server",
    ]);
    // Bare UI Actions stay bare; the mixed client/server form is preserved.
    assert.deepEqual(surfacesFromFilename("approve.ui-action.js"), ["ui-action"]);
    assert.deepEqual(surfacesFromFilename("src/ui-actions/approve.js"), ["ui-action"]);
    assert.deepEqual(surfacesFromFilename("src/server/close.client.ui-action.js"), [
      "ui-action",
      "client",
      "server",
    ]);
    // A subtype that cannot compose with a UI Action still refuses.
    assert.deepEqual(surfacesFromFilename("src/server/approve.ui-action.br.js"), []);
    assert.deepEqual(surfacesFromFilename("approve.server.ui-action.acl.js"), []);
    // Outside the project only the basename counts, so the decoy `server/`
    // segment contributes nothing while the compound suffix still does.
    assert.deepEqual(surfacesFromFilename("/elsewhere/server/approve.ui-action.js", "/proj"), [
      "ui-action",
    ]);
    assert.deepEqual(surfacesFromFilename("/elsewhere/approve.server.ui-action.js", "/proj"), [
      "ui-action",
      "server",
    ]);
  });
});
