import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, it } from "node:test";
import {
  canonicalRegistryTarballUrl,
  moduleResolver,
  readResponseBytes,
  tarFiles,
  verifyIntegrity,
} from "../scripts/audit-fluent-sdk.mjs";

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
  it("requires the exact npm registry artifact URL", () => {
    const canonical = "https://registry.npmjs.org/@servicenow/sdk/-/sdk-4.11.0.tgz";
    assert.equal(canonicalRegistryTarballUrl(canonical, "@servicenow/sdk", "4.11.0"), canonical);
    for (const candidate of [
      "https://attacker.example/@servicenow/sdk/-/sdk-4.11.0.tgz",
      "https://registry.npmjs.org/@servicenow/sdk/-/sdk-4.10.1.tgz",
      "https://registry.npmjs.org/@servicenow/sdk/-/sdk-4.11.0.tgz?mirror=1",
      "https://user@registry.npmjs.org/@servicenow/sdk/-/sdk-4.11.0.tgz",
      "http://registry.npmjs.org/@servicenow/sdk/-/sdk-4.11.0.tgz",
      "https://registry.npmjs.org/@servicenow/sdk/-/sdk-4.11.0.tgz#artifact",
    ]) {
      assert.throws(
        () => canonicalRegistryTarballUrl(candidate, "@servicenow/sdk", "4.11.0"),
        /canonical npm artifact/,
      );
    }
  });

  it("caps both declared and streamed response bytes", async () => {
    await assert.rejects(
      readResponseBytes(
        new Response(Buffer.alloc(4), { headers: { "content-length": "4" } }),
        "fixture",
        3,
      ),
      /declared response exceeds/,
    );
    const streamed = new Response(Buffer.alloc(4));
    assert.equal(streamed.headers.has("content-length"), false);
    await assert.rejects(readResponseBytes(streamed, "fixture", 3), (error) => {
      assert.equal(String(error), "Error: fixture: response exceeds 3 bytes");
      return true;
    });
    assert.deepEqual(
      await readResponseBytes(
        new Response(Buffer.from("safe"), { headers: { "content-length": "4" } }),
        "fixture",
        4,
      ),
      Buffer.from("safe"),
    );
  });

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
