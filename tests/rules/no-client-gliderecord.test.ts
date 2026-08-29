import { describe, it } from "node:test";
import { assertInvalid, assertValid } from "../helpers/rule-tester.js";

const RULE = "no-client-gliderecord" as const;

describe(RULE, () => {
  it("flags GlideRecord in a client filename", () => {
    assertInvalid(
      `var gr = new GlideRecord("sys_user");`,
      RULE,
      { messageId: "glideRecord" },
      {
        filename: "incident.client.js",
        settings: { scope: "scoped" },
      },
    );
  });

  it("flags GlideRecord when g_form is used", () => {
    assertInvalid(
      `g_form.setValue("x", "1");\nvar gr = new GlideRecord("sys_user");`,
      RULE,
      { messageId: "glideRecord" },
      { filename: "onChange.js", settings: { scope: "scoped" } },
    );
  });

  it("flags global namespace and computed constructors", () => {
    assertInvalid(
      `new global.GlideRecord("incident");
new global["GlideRecordSecure"]("task");`,
      RULE,
      { messageId: "glideRecord", count: 2 },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("flags direct and destructured constructor aliases", () => {
    assertInvalid(
      `var GR = GlideRecord;
const Alias = GR;
const { GlideRecordSecure: GRS } = global;
Alias("incident");
new GRS("task");
function onLoad() {
  var InnerGR = GlideRecord;
  new InnerGR("problem");
}`,
      RULE,
      { messageId: "glideRecord", count: 3 },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("flags a stable constructor alias declared inside its use block", () => {
    assertInvalid(
      `if (condition) {
  const GR = GlideRecord;
  new GR("incident");
}`,
      RULE,
      { messageId: "glideRecord" },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("forgets a reassigned constructor alias", () => {
    assertValid(
      `var GR = GlideRecord;
GR = LocalRecord;
new GR("incident");`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("does not merge mutually exclusive constructor assignments", () => {
    const options = { filename: "form.client.js", settings: { scope: "scoped" as const } };
    assertValid(
      `var GR;
if (condition) {
  GR = LocalRecord;
} else {
  GR = GlideRecord;
}
new GR("incident");`,
      RULE,
      options,
    );
    assertValid(
      `var GR;
if (condition) {
  GR = GlideRecord;
} else {
  GR = LocalRecord;
}
new GR("incident");`,
      RULE,
      options,
    );
  });

  it("stays silent for mutable aliases even when every branch selects a platform constructor", () => {
    assertValid(
      `var GR;
if (condition) {
  GR = GlideRecord;
} else {
  GR = GlideRecordSecure;
}
new GR("incident");`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("requires an alias initializer to dominate the call in one execution body", () => {
    assertValid(
      `run();
var GR = GlideRecord;
function run() {
  new GR("incident");
}`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
    assertValid(
      `if (condition) {
  var ConditionalGR = GlideRecord;
}
new ConditionalGR("incident");`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("distinguishes local eval from dynamic global scope", () => {
    assertInvalid(
      `function eval() {}
var GR = GlideRecord;
eval("GR = LocalRecord");
new GR("incident");`,
      RULE,
      { messageId: "glideRecord" },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
    assertValid(
      `var GR = GlideRecord;
eval("GR = LocalRecord");
new GR("incident");`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
    assertValid(
      `var GR = GlideRecord;
eval?.("GR = LocalRecord");
new GR("incident");`,
      RULE,
      {
        filename: "form.client.js",
        settings: { javascriptMode: "es2021", scope: "scoped" },
      },
    );
  });

  it("stays silent when the platform constructor can be replaced", () => {
    const options = { filename: "form.client.js", settings: { scope: "scoped" as const } };
    assertValid(
      `GlideRecord = LocalRecord;
new GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `global.GlideRecord = LocalRecord;
new GlideRecord("incident");
new global.GlideRecord("task");`,
      RULE,
      options,
    );
    assertValid(
      `global = localNamespace;
new global.GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `Object.defineProperty(global, "GlideRecord", { value: LocalRecord });
new GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `GlideRecord = null;
new GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `global.GlideRecord = undefined;
new global.GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `delete global.GlideRecord;
new global.GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `Object.defineProperty(global, "GlideRecord", { value: null });
new GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `Object.assign(global, { GlideRecord: null });
new GlideRecord("incident");`,
      RULE,
      options,
    );
    assertValid(
      `new GlideRecord("incident");
GlideRecord = LocalRecord;`,
      RULE,
      options,
    );
  });

  it("treats escaping the namespace, but not its constructor value, as a possible mutation", () => {
    assertValid(
      `prepare(global);
new GlideRecord("incident");
new global.GlideRecord("task");`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
    assertInvalid(
      `prepare(global.GlideRecord);
new global.GlideRecord("incident");`,
      RULE,
      { messageId: "glideRecord" },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
    assertValid(
      `var platform = global;
prepare(platform);
new GlideRecord("incident");`,
      RULE,
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
    assertInvalid(
      `prepare(platform);
var platform = global;
new GlideRecord("incident");`,
      RULE,
      { messageId: "glideRecord" },
      { filename: "form.client.js", settings: { scope: "scoped" } },
    );
  });

  it("follows stable mutable namespace aliases for authority loss", () => {
    const options = { filename: "form.client.js", settings: { scope: "scoped" as const } };
    for (const code of [
      `var ns = global;
ns.GlideRecord = null;
new GlideRecord("incident");`,
      `let ns = global;
delete ns.GlideRecord;
new GlideRecord("incident");`,
      `var ns = global;
Object.defineProperty(ns, "GlideRecord", { value: null });
new GlideRecord("incident");`,
      `let ns = global;
Object.assign(ns, { GlideRecord: undefined });
new GlideRecord("incident");`,
      `{
  let ns = global;
  ns.GlideRecord = null;
}
new GlideRecord("incident");`,
      `var ns = global;
prepare(ns);
new GlideRecord("incident");`,
    ]) {
      assertValid(code, RULE, options);
    }
  });

  it("retains authority effects that occur before a namespace alias is reassigned", () => {
    const options = { filename: "form.client.js", settings: { scope: "scoped" as const } };
    for (const code of [
      `var ns = global;
prepare(ns);
ns = localNamespace;
new GlideRecord("incident");`,
      `var ns = global;
ns.GlideRecord = null;
ns = localNamespace;
new GlideRecord("incident");`,
      `var ns = global;
ns = (prepare(ns), localNamespace);
new GlideRecord("incident");`,
      `var ns = global;
function replaceLater() { ns = localNamespace; }
prepare(ns);
new GlideRecord("incident");`,
    ]) {
      assertValid(code, RULE, options);
    }
  });

  it("does not follow definitely reassigned namespace aliases", () => {
    const options = { filename: "form.client.js", settings: { scope: "scoped" as const } };
    assertInvalid(
      `let ns = global;
ns = localNamespace;
ns.GlideRecord = null;
new GlideRecord("incident");`,
      RULE,
      { messageId: "glideRecord" },
      options,
    );
    assertValid(
      `var ns = global;
eval("ns = localNamespace");
ns.GlideRecord = null;
new GlideRecord("incident");`,
      RULE,
      options,
    );
    assertInvalid(
      `var ns = global;
ns = localNamespace;
prepare(ns);
new GlideRecord("incident");`,
      RULE,
      { messageId: "glideRecord" },
      options,
    );
  });

  it("rejects destructuring defaults and shadowed namespaces", () => {
    const options = { filename: "form.client.js", settings: { scope: "scoped" as const } };
    assertValid(
      `const { GlideRecord: GR = LocalRecord } = global;
new GR("incident");`,
      RULE,
      options,
    );
    assertValid(
      `function run(global) {
  new global.GlideRecord("incident");
}`,
      RULE,
      options,
    );
  });

  it("stays silent for global or unknown application scope", () => {
    assertValid(`var gr = new GlideRecord("sys_user");`, RULE, {
      filename: "global.client.js",
      settings: { scope: "global" },
    });
    assertValid(`var gr = new GlideRecord("sys_user");`, RULE, {
      filename: "unknown.client.js",
    });
    assertValid(`var gr = new GlideRecord("sys_user");`, RULE, {
      filename: "explicit-unknown.client.js",
      settings: { scope: "unknown" },
    });
  });

  it("allows GlideRecord on the server", () => {
    assertValid(`var gr = new GlideRecord("incident");\ngr.query();`, RULE, {
      filename: "incident.br.js",
    });
  });

  it("allows GlideRecord in a display Business Rule that writes g_scratchpad", () => {
    assertValid(
      `var gr = new GlideRecord("incident");\ngr.query();\ng_scratchpad.count = 1;`,
      RULE,
      { filename: "display-stuff.br.js" },
    );
  });

  it("ignores decoy directory names above the project root (FINDINGS.md COR-001)", () => {
    const code = `var gr = new GlideRecord("incident");\ngr.query();`;
    // A checkout under ~/client/ must not make server code look client-side.
    assertValid(code, RULE, {
      filename: "/home/alice/client/app/src/list.js",
      cwd: "/home/alice/client/app",
      settings: { scope: "scoped" },
    });
    assertValid(code, RULE, {
      filename: "/srv/app/src/list.js",
      cwd: "/srv/app",
      settings: { scope: "scoped" },
    });
    // A real project-relative client directory still applies the rule.
    assertInvalid(
      code,
      RULE,
      { count: 1 },
      { filename: "/proj/src/client/list.js", cwd: "/proj", settings: { scope: "scoped" } },
    );
  });
});
