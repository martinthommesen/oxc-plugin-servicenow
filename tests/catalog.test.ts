import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ruleCatalog } from "../src/catalog.js";
import { lint } from "./helpers/rule-tester.js";

describe("rule catalog examples", () => {
  for (const entry of ruleCatalog) {
    describe(entry.name, () => {
      for (const example of entry.bad) {
        it(`flags: ${example.name}`, () => {
          const messages = lint(example.code, entry.name, {
            filename: example.filename ?? "test.js",
            settings: example.settings,
          });
          assert.ok(
            messages.length > 0,
            `catalog bad example "${example.name}" for ${entry.name} produced no diagnostics`,
          );
        });
      }

      for (const example of entry.good) {
        it(`allows: ${example.name}`, () => {
          const messages = lint(example.code, entry.name, {
            filename: example.filename ?? "test.js",
            settings: example.settings,
          });
          assert.equal(
            messages.length,
            0,
            `catalog good example "${example.name}" for ${entry.name} produced:\n${messages
              .map((message) => `  - ${message.messageId ?? "?"} ${message.message}`)
              .join("\n")}`,
          );
        });
      }
    });
  }
});
