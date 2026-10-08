import { ruleTester } from "../helpers/rule-tester.js";
import { describe, it } from "node:test";
import {} from "../helpers/rule-tester.js";

const RULE = "no-client-gliderecord" as const;
const SCOPED_CLIENT = { filename: "form.client.js", settings: { scope: "scoped" } } as const;

describe(RULE, () => {
  const { expectInvalid, expectValid, expectActive, expectSkipped } = ruleTester(
    "no-client-gliderecord",
    {
      filename: "incident.client.js",
      settings: { scope: "scoped" },
    },
    { messageId: "glideRecord" },
  );

  it("flags GlideRecord in a client filename", () =>
    void expectInvalid(`var gr = new GlideRecord("sys_user");`));

  it("flags GlideRecord when g_form is used", () =>
    void expectInvalid(
      `g_form.setValue("x", "1");\nvar gr = new GlideRecord("sys_user");`,
      undefined,
      {
        filename: "onChange.js",
        settings: { scope: "scoped" },
      },
    ));

  it("flags global namespace and computed constructors", () =>
    void expectInvalid(
      `new global.GlideRecord("incident");
new global["GlideRecordSecure"]("task");`,
      { messageId: "glideRecord", count: 2 },
      SCOPED_CLIENT,
    ));

  it("flags direct and destructured constructor aliases", () =>
    void expectInvalid(
      `var GR = GlideRecord;
const Alias = GR;
const { GlideRecordSecure: GRS } = global;
Alias("incident");
new GRS("task");
function onLoad() {
  var InnerGR = GlideRecord;
  new InnerGR("problem");
}`,
      { messageId: "glideRecord", count: 3 },
      SCOPED_CLIENT,
    ));

  it("flags a stable constructor alias declared inside its use block", () =>
    void expectInvalid(
      `if (condition) {
  const GR = GlideRecord;
  new GR("incident");
}`,
      undefined,
      SCOPED_CLIENT,
    ));

  it("forgets a reassigned constructor alias", () =>
    void expectValid(
      `var GR = GlideRecord;
GR = LocalRecord;
new GR("incident");`,
      SCOPED_CLIENT,
    ));

  it("does not merge mutually exclusive constructor assignments", () => {
    expectValid(
      `var GR;
if (condition) {
  GR = LocalRecord;
} else {
  GR = GlideRecord;
}
new GR("incident");`,
      SCOPED_CLIENT,
    );
    expectValid(
      `var GR;
if (condition) {
  GR = GlideRecord;
} else {
  GR = LocalRecord;
}
new GR("incident");`,
      SCOPED_CLIENT,
    );
  });

  it("stays silent for mutable aliases even when every branch selects a platform constructor", () =>
    void expectActive(
      `var GR;
if (condition) {
  GR = GlideRecord;
} else {
  GR = GlideRecordSecure;
}
new GR("incident");`,
      SCOPED_CLIENT,
    ));

  it("requires an alias initializer to dominate the call in one execution body", () => {
    expectValid(
      `run();
var GR = GlideRecord;
function run() {
  new GR("incident");
}`,
      SCOPED_CLIENT,
    );
    expectValid(
      `if (condition) {
  var ConditionalGR = GlideRecord;
}
new ConditionalGR("incident");`,
      SCOPED_CLIENT,
    );
  });

  it("distinguishes local eval from dynamic global scope", () => {
    expectInvalid(
      `function eval() {}
var GR = GlideRecord;
eval("GR = LocalRecord");
new GR("incident");`,
      undefined,
      SCOPED_CLIENT,
    );
    expectValid(
      `var GR = GlideRecord;
eval("GR = LocalRecord");
new GR("incident");`,
      SCOPED_CLIENT,
    );
    expectValid(
      `var GR = GlideRecord;
eval?.("GR = LocalRecord");
new GR("incident");`,
      { ...SCOPED_CLIENT, settings: { javascriptMode: "es2021", scope: "scoped" } },
    );
  });

  it("stays silent when the platform constructor can be replaced", () => {
    expectActive(
      `GlideRecord = LocalRecord;
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `global.GlideRecord = LocalRecord;
new GlideRecord("incident");
new global.GlideRecord("task");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `global = localNamespace;
new global.GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `Object.defineProperty(global, "GlideRecord", { value: LocalRecord });
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `GlideRecord = null;
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `global.GlideRecord = undefined;
new global.GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `delete global.GlideRecord;
new global.GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `Object.defineProperty(global, "GlideRecord", { value: null });
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `Object.assign(global, { GlideRecord: null });
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectActive(
      `new GlideRecord("incident");
GlideRecord = LocalRecord;`,
      SCOPED_CLIENT,
    );
  });

  it("treats escaping the namespace, but not its constructor value, as a possible mutation", () => {
    expectValid(
      `prepare(global);
new GlideRecord("incident");
new global.GlideRecord("task");`,
      SCOPED_CLIENT,
    );
    expectInvalid(
      `prepare(global.GlideRecord);
new global.GlideRecord("incident");`,
      undefined,
      SCOPED_CLIENT,
    );
    expectValid(
      `var platform = global;
prepare(platform);
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectInvalid(
      `prepare(platform);
var platform = global;
new GlideRecord("incident");`,
      undefined,
      SCOPED_CLIENT,
    );
  });

  it("follows stable mutable namespace aliases for authority loss", () => {
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
      expectValid(code, SCOPED_CLIENT);
    }
  });

  it("retains authority effects that occur before a namespace alias is reassigned", () => {
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
      expectValid(code, SCOPED_CLIENT);
    }
  });

  it("does not follow definitely reassigned namespace aliases", () => {
    expectInvalid(
      `let ns = global;
ns = localNamespace;
ns.GlideRecord = null;
new GlideRecord("incident");`,
      undefined,
      SCOPED_CLIENT,
    );
    expectValid(
      `var ns = global;
eval("ns = localNamespace");
ns.GlideRecord = null;
new GlideRecord("incident");`,
      SCOPED_CLIENT,
    );
    expectInvalid(
      `var ns = global;
ns = localNamespace;
prepare(ns);
new GlideRecord("incident");`,
      undefined,
      SCOPED_CLIENT,
    );
  });

  it("rejects destructuring defaults and shadowed namespaces", () => {
    expectValid(
      `const { GlideRecord: GR = LocalRecord } = global;
new GR("incident");`,
      SCOPED_CLIENT,
    );
    expectValid(
      `function run(global) {
  new global.GlideRecord("incident");
}`,
      SCOPED_CLIENT,
    );
  });

  it("stays silent for global or unknown application scope", () => {
    expectSkipped(`var gr = new GlideRecord("sys_user");`, {
      filename: "global.client.js",
      settings: { scope: "global" },
    });
    expectSkipped(`var gr = new GlideRecord("sys_user");`, {
      filename: "unknown.client.js",
    });
    expectSkipped(`var gr = new GlideRecord("sys_user");`, {
      filename: "explicit-unknown.client.js",
      settings: { scope: "unknown" },
    });
  });

  it("allows GlideRecord on the server", () =>
    void expectValid(`var gr = new GlideRecord("incident");\ngr.query();`, {
      filename: "incident.br.js",
    }));

  it("allows GlideRecord in a display Business Rule that writes g_scratchpad", () =>
    void expectValid(
      `var gr = new GlideRecord("incident");\ngr.query();\ng_scratchpad.count = 1;`,
      {
        filename: "display-stuff.br.js",
      },
    ));

  it("ignores decoy directory names above the project root (FINDINGS.md COR-001)", () => {
    const code = `var gr = new GlideRecord("incident");\ngr.query();`;
    // A checkout under ~/client/ must not make server code look client-side.
    expectSkipped(code, {
      filename: "/home/alice/client/app/src/list.js",
      cwd: "/home/alice/client/app",
      settings: { scope: "scoped" },
    });
    expectSkipped(code, {
      filename: "/srv/app/src/list.js",
      cwd: "/srv/app",
      settings: { scope: "scoped" },
    });
    // A real project-relative client directory still applies the rule.
    expectInvalid(
      code,
      { count: 1 },
      { filename: "/proj/src/client/list.js", cwd: "/proj", settings: { scope: "scoped" } },
    );
  });
});
