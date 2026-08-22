import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  checkActionPins,
  checkActionPinSources,
  parseActionPinCatalog,
} from "../scripts/check-action-pins.mjs";

const checkoutCommit = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const checkoutPin = [{ action: "actions/checkout", commit: checkoutCommit }];

function workflowWithStep(step: string): string {
  return `jobs:\n  test:\n    steps:\n      ${step}\n`;
}

describe("workflow action pins", () => {
  const yamlForms = [
    '- "uses": actions/checkout@REF',
    "- 'uses' : 'actions/checkout@REF'",
    '- uses : "actions/checkout@REF"',
    '- { uses: "actions/checkout@REF" }',
  ];

  it("finds quoted, spaced, and flow-style uses entries", () => {
    for (const form of yamlForms) {
      const result = checkActionPinSources(
        [{ file: "fixture.yml", text: workflowWithStep(form.replace("REF", checkoutCommit)) }],
        checkoutPin,
      );
      assert.deepEqual(result, { workflows: 1, actions: 1 });
    }
  });

  it("rejects mutable references in every supported YAML form", () => {
    for (const form of yamlForms) {
      assert.throws(
        () =>
          checkActionPinSources(
            [{ file: "fixture.yml", text: workflowWithStep(form.replace("REF", "main")) }],
            checkoutPin,
          ),
        /actions\/checkout@main is not pinned to a full SHA/,
      );
    }
  });

  it("fails closed on non-string uses values and malformed YAML", () => {
    assert.throws(
      () =>
        checkActionPinSources(
          [{ file: "fixture.yml", text: workflowWithStep("- uses: [actions/checkout]") }],
          checkoutPin,
        ),
      /uses must be a string action reference/,
    );
    assert.throws(
      () => checkActionPinSources([{ file: "fixture.yml", text: "jobs: [" }], checkoutPin),
      /fixture\.yml/,
    );
  });

  it("checks job-level reusable workflows and permits local workflows", () => {
    const reusableWorkflow = "example/tools/.github/workflows/build.yml";
    const result = checkActionPinSources(
      [
        {
          file: "fixture.yml",
          text: `jobs:\n  local:\n    uses: ./.github/workflows/local.yml\n  remote:\n    uses: ${reusableWorkflow}@${checkoutCommit}\n`,
        },
      ],
      [{ action: reusableWorkflow, commit: checkoutCommit }],
    );
    assert.deepEqual(result, { workflows: 1, actions: 1 });
  });

  it("rejects malformed and duplicate central pin entries", () => {
    const source = [
      {
        file: "fixture.yml",
        text: workflowWithStep(`- uses: actions/checkout@${checkoutCommit}`),
      },
    ];
    assert.throws(
      () => checkActionPinSources(source, [...checkoutPin, ...checkoutPin]),
      /duplicate action actions\/checkout/,
    );
    assert.throws(
      () => checkActionPinSources(source, [{ action: "actions/checkout", commit: "main" }]),
      /invalid action pin entry/,
    );
  });

  it("resolves aliases used as mapping keys before validating references", () => {
    const source = `env:\n  ACTION_KEY: &action_key uses\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@${checkoutCommit}\n      - *action_key : actions/checkout@main\n`;
    assert.throws(
      () => checkActionPinSources([{ file: "fixture.yml", text: source }], checkoutPin),
      /actions\/checkout@main is not pinned to a full SHA/,
    );
  });

  it("ignores uses data outside executable job and step positions", () => {
    const source = `env:\n  uses: not-an-action\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@${checkoutCommit}\n`;
    assert.deepEqual(checkActionPinSources([{ file: "fixture.yml", text: source }], checkoutPin), {
      workflows: 1,
      actions: 1,
    });
  });

  it("rejects unknown, mismatched, and divergent external action pins", () => {
    const otherCommit = "1111111111111111111111111111111111111111";
    assert.throws(
      () =>
        checkActionPinSources(
          [
            {
              file: "fixture.yml",
              text: workflowWithStep(`- uses: actions/cache@${checkoutCommit}`),
            },
          ],
          checkoutPin,
        ),
      /actions\/cache is not in scripts\/action-pins\.json/,
    );
    assert.throws(
      () =>
        checkActionPinSources(
          [
            {
              file: "fixture.yml",
              text: workflowWithStep(`- uses: actions/checkout@${otherCommit}`),
            },
          ],
          checkoutPin,
        ),
      /differs from centrally reviewed/,
    );
    assert.throws(
      () =>
        checkActionPinSources(
          [
            {
              file: "first.yml",
              text: workflowWithStep(`- uses: actions/checkout@${checkoutCommit}`),
            },
            {
              file: "second.yml",
              text: workflowWithStep(`- uses: actions/checkout@${otherCommit}`),
            },
          ],
          checkoutPin,
        ),
      /actions\/checkout diverges from first\.yml/,
    );
  });

  it("loads the production pin catalog without collapsing duplicate keys", () => {
    const source = readFileSync(new URL("../scripts/action-pins.json", import.meta.url), "utf8");
    assert.equal(parseActionPinCatalog(source).length, 5);
    assert.deepEqual(checkActionPins(), { workflows: 4, actions: 5 });
    assert.throws(
      () =>
        parseActionPinCatalog(
          `{"actions/checkout":"${checkoutCommit}","actions/checkout":"1111111111111111111111111111111111111111"}`,
        ),
      /invalid action pin catalog/,
    );
    assert.throws(
      () => parseActionPinCatalog(`{"actions/checkout":"${checkoutCommit}"}`),
      /expected an array of action pins/,
    );
  });
});
