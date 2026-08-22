import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, it } from "node:test";
import { moduleResolver, tarFiles, verifyIntegrity } from "../scripts/audit-fluent-sdk.mjs";

function tar(entries: Array<{ name: string; type?: string }>): Buffer {
  const blocks = entries.map(({ name, type = "0" }) => {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write("00000000000\0", 124, 12, "ascii");
    header.write(type, 156, 1, "ascii");
    return header;
  });
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

describe("Fluent SDK tarball trust boundary", () => {
  it("caps decompressed tarball bytes", () => {
    assert.throws(() => tarFiles(gzipSync(Buffer.alloc(2_048)), "fixture", 1_024));
  });
  it("verifies the pinned SHA-512 digest", () => {
    const bytes = Buffer.from("artifact");
    const digest = createHash("sha512").update(bytes).digest("base64");
    assert.doesNotThrow(() => verifyIntegrity(bytes, `sha512-${digest}`, "fixture"));
    assert.throws(() => verifyIntegrity(bytes, "sha512-AAAA", "fixture"), /integrity mismatch/);
  });

  it("rejects unsafe, duplicate, and linked tar entries", () => {
    assert.throws(
      () => tarFiles(tar([{ name: "package/../escape" }]), "fixture"),
      /unsafe tar path/,
    );
    assert.throws(
      () => tarFiles(tar([{ name: "package/a" }, { name: "package/a" }]), "fixture"),
      /duplicate tar path/,
    );
    assert.throws(
      () => tarFiles(tar([{ name: "package/link", type: "2" }]), "fixture"),
      /unsupported tar entry type/,
    );
  });

  it("expands every wildcard in a package export target", () => {
    const sdk = {
      name: "sdk",
      files: new Map([
        ["package/index.d.ts", Buffer.from('export * from "@servicenow/sdk-core/example";')],
      ]),
    };
    const core = {
      name: "core",
      manifest: { exports: { "./*": "./types/*/index-*.d.ts" } },
      files: new Map([
        [
          "package/types/example/index-example.d.ts",
          Buffer.from("export declare const value: string;"),
        ],
      ]),
    };

    const exports = moduleResolver(sdk, core).inspect(sdk, "package/index.d.ts");
    assert.equal(exports.get("value")?.declarationPath, "types/example/index-example.d.ts");
  });
});
