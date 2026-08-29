import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { X509Certificate, crypto as sigstoreCrypto, dsse } from "@sigstore/core";
import { initializeCA } from "@sigstore/mock";
import { Verifier } from "@sigstore/verify";
import { parse } from "yaml";
import { checkActionPins } from "../../scripts/check-action-pins.mjs";
import {
  collectLiveGovernance,
  compareGovernance,
  normalizeLiveGovernance,
  validateDesiredGovernance,
} from "../../scripts/check-release-governance.mjs";
import { packageTargetPath } from "../../scripts/check-release-artifact.mjs";
import {
  parseNpmVersion,
  assertTrustedPublishingNpm,
} from "../../scripts/check-trusted-publishing-npm.mjs";
import {
  changelogReleaseNotes,
  githubReleaseCreateArgs,
  parseReleaseView,
  releaseAction,
  releaseAssetNames,
  resolveTagCommit,
  validateExistingRelease,
} from "../../scripts/create-github-release.mjs";
import {
  classifyPublishResult,
  compareReleaseVersions,
  publicationStateResult,
  releaseDistTag,
  validateRegistryVersionOrder,
} from "../../scripts/publish-release-package.mjs";
import {
  canonicalAttestationUrl,
  fetchAttestations,
  isTransientRegistryError,
  parseNpmCommandResult,
  parseRetryAfterMs,
  retryBounded,
  verifyInstallWithRetry,
  verifyProvenanceAttestation,
} from "../../scripts/verify-published-package.mjs";
import { repoRoot } from "../integration/helpers.js";

const workflowText = readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8");
const workflow = parse(workflowText) as any;
const ciWorkflow = parse(
  readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8"),
) as any;
const governanceWorkflow = parse(
  readFileSync(path.join(repoRoot, ".github/workflows/governance-audit.yml"), "utf8"),
) as any;
const recoveryWorkflow = parse(
  readFileSync(path.join(repoRoot, ".github/workflows/recover-release.yml"), "utf8"),
) as any;
const desiredFixture = JSON.parse(
  readFileSync(path.join(repoRoot, "tests/fixtures/release-governance/desired.json"), "utf8"),
);
const authoritativeDesiredFixture = JSON.parse(
  readFileSync(path.join(repoRoot, "scripts/release-governance.json"), "utf8"),
);
const liveFixture = JSON.parse(
  readFileSync(path.join(repoRoot, "tests/fixtures/release-governance/valid.json"), "utf8"),
);

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("release automation gates", () => {
  it("enforces one full-SHA action pin set across workflows", () => {
    const result = checkActionPins();
    assert.equal(result.workflows, 5);
    assert.equal(result.actions, 5);
  });

  it("accepts only the pinned executable npm version", () => {
    assert.equal(parseNpmVersion("11.5.1\n"), "11.5.1");
    assert.equal(assertTrustedPublishingNpm("11.5.1", "11.5.1"), "11.5.1");
    assert.throws(() => parseNpmVersion("v11.5.1\n"), /invalid/);
    assert.throws(() => assertTrustedPublishingNpm("11.5.2", "11.5.1"), /requires npm/);
  });

  it("models stable and prerelease publication without moving latest", () => {
    assert.equal(releaseDistTag("2.0.0"), "latest");
    assert.equal(releaseDistTag("2.0.0-rc.1"), "next");
    assert.throws(() => releaseDistTag("v2.0.0"), /invalid/);
    assert.deepEqual(classifyPublishResult({ status: 0, signal: null, stdout: "{}", stderr: "" }), {
      outcome: "published",
    });
    assert.deepEqual(
      classifyPublishResult({
        status: 1,
        signal: null,
        stdout: '{"error":{"code":"ETIMEDOUT"}}',
        stderr: "",
      }),
      { outcome: "ambiguous", code: "ETIMEDOUT" },
    );
    assert.deepEqual(
      classifyPublishResult({
        status: 1,
        signal: null,
        stdout: '{"error":{"code":"EPUBLISHCONFLICT"}}',
        stderr: "",
      }),
      { outcome: "verify-existing", code: "EPUBLISHCONFLICT" },
    );
    assert.throws(
      () =>
        classifyPublishResult({
          status: 1,
          signal: null,
          stdout: '{"error":{"code":"E401"}}',
          stderr: "",
        }),
      /permanently/,
    );
    assert.deepEqual(
      publicationStateResult(
        { status: 1, signal: null, stdout: '{"error":{"code":"E404"}}', stderr: "" },
        "pkg",
        "2.0.0",
      ),
      { state: "absent" },
    );
    assert.ok(compareReleaseVersions("2.0.0", "2.0.0-rc.1") > 0);
    assert.ok(compareReleaseVersions("2.0.0-rc.10", "2.0.0-rc.2") > 0);
    // Hyphenated prerelease identifiers must not be truncated (FINDINGS.md
    // REL-001). "rc-2" is one alphanumeric identifier compared as ASCII.
    assert.ok(compareReleaseVersions("2.0.0-rc-2", "2.0.0-rc-1") > 0);
    assert.ok(compareReleaseVersions("2.0.0-beta-hotfix", "2.0.0-beta") > 0);
    assert.equal(compareReleaseVersions("2.0.0-rc-1", "2.0.0-rc-1"), 0);
    assert.deepEqual(
      validateRegistryVersionOrder(
        { versions: ["2.0.0-rc-1"], "dist-tags": { next: "2.0.0-rc-1" } },
        "2.0.0-rc-2",
      ),
      { existing: false, highest: "2.0.0-rc-1" },
    );
    assert.deepEqual(
      validateRegistryVersionOrder(
        { versions: ["1.1.0", "2.0.0-rc.1"], "dist-tags": { latest: "1.1.0" } },
        "2.0.0",
      ),
      { existing: false, highest: "2.0.0-rc.1" },
    );
    assert.throws(
      () =>
        validateRegistryVersionOrder(
          { versions: ["2.0.0"], "dist-tags": { latest: "2.0.0" } },
          "1.9.0",
        ),
      /not greater/,
    );
    assert.deepEqual(
      validateRegistryVersionOrder(
        { versions: ["2.0.0"], "dist-tags": { latest: "2.0.0" } },
        "2.0.0",
      ),
      { existing: true },
    );
  });

  it("resolves only existing lightweight or bounded annotated tags at the expected commit", () => {
    const commit = "a".repeat(40);
    assert.equal(
      resolveTagCommit({
        tag: "v2.0.0",
        expectedCommit: commit,
        readRef: () => ({ object: { type: "commit", sha: commit } }),
        readTag: () => ({}),
      }),
      commit,
    );
    assert.equal(
      resolveTagCommit({
        tag: "v2.0.0",
        expectedCommit: commit,
        readRef: () => ({ object: { type: "tag", sha: "b".repeat(40) } }),
        readTag: () => ({ object: { type: "commit", sha: commit } }),
      }),
      commit,
    );
    assert.throws(
      () =>
        resolveTagCommit({
          tag: "v2.0.0",
          expectedCommit: commit,
          readRef: () => ({}),
          readTag: () => ({}),
        }),
      /malformed/,
    );
    assert.throws(
      () =>
        resolveTagCommit({
          tag: "v2.0.0",
          expectedCommit: commit,
          readRef: () => ({ object: { type: "commit", sha: "c".repeat(40) } }),
          readTag: () => ({}),
        }),
      /expected/,
    );
    assert.throws(
      () =>
        resolveTagCommit({
          tag: "v2.0.0",
          expectedCommit: commit,
          readRef: () => ({ object: { type: "tag", sha: "b".repeat(40) } }),
          readTag: () => ({ object: { type: "tag", sha: "b".repeat(40) } }),
        }),
      /cycle/,
    );
  });

  it("requires the release tag commit to equal the freshly fetched main tip", () => {
    const steps = workflow.jobs.validate.steps as any[];
    const tipIndex = steps.findIndex(
      (step) => step.name === "Verify release tag is current main tip",
    );
    const installIndex = steps.findIndex((step) => step.run === "npm ci");
    assert.ok(tipIndex > 0, "release main-tip step is missing");
    assert.ok(tipIndex < installIndex, "release main-tip check must run before dependency install");
    const commands = steps[tipIndex].run
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean);
    const equality = 'test "$GITHUB_SHA" = "$(git rev-parse origin/main)"';
    assert.deepEqual(commands, ["git fetch origin main", equality]);
    assert.doesNotMatch(workflowText, /merge-base --is-ancestor/);
  });

  it("creates releases with tag verification and prerelease mode", () => {
    assert.deepEqual(releaseAction(undefined, "pkg.tgz"), "create");
    assert.equal(releaseAction({ tagName: "v2.0.0", assets: [] }, "pkg.tgz"), "upload-asset");
    assert.equal(
      releaseAction({ tagName: "v2.0.0", assets: [{ name: "pkg.tgz" }] }, "pkg.tgz"),
      "verify-asset",
    );
    assert.deepEqual(releaseAssetNames({ assets: [{ name: "pkg.tgz" }, { name: 1 }] }), [
      "pkg.tgz",
    ]);
    assert.equal(parseReleaseView('{"tagName":"v2.0.0"}').tagName, "v2.0.0");
    assert.throws(() => parseReleaseView("[]"), /no release object/);
    assert.equal(packageTargetPath("./dist/index.js"), "package/dist/index.js");
    const stable = githubReleaseCreateArgs("v2.0.0", "2.0.0", "pkg.tgz", "notes.md");
    const prerelease = githubReleaseCreateArgs("v2.0.0-rc.1", "2.0.0-rc.1", "pkg.tgz", "notes.md");
    assert.ok(stable.includes("--verify-tag"));
    assert.ok(stable.includes("--notes-file"));
    assert.ok(!stable.includes("--notes"));
    assert.ok(!stable.includes("--prerelease"));
    assert.ok(prerelease.includes("--prerelease"));
  });

  it("requires exact changelog-backed release metadata and one artifact", () => {
    const notes = changelogReleaseNotes(
      "# Changelog\n\n## Unreleased\n\n## 2.0.0 — 2026-08-21\n\n### Fixes\n\n- Exact.\n\n## 1.0.0 — 2026-01-01\n\nOld.\n",
      "2.0.0",
    );
    assert.equal(notes, "### Fixes\n\n- Exact.");
    const expected = {
      tag: "v2.0.0",
      version: "2.0.0",
      assetName: "pkg.tgz",
      prerelease: false,
      notes,
    };
    const release = {
      tagName: "v2.0.0",
      name: "v2.0.0",
      isDraft: false,
      isPrerelease: false,
      body: notes,
      assets: [{ name: "pkg.tgz" }],
    };
    assert.equal(validateExistingRelease(release, expected), release);
    for (const mutate of [
      (value: any) => (value.name = "stale"),
      (value: any) => (value.isDraft = true),
      (value: any) => (value.isPrerelease = true),
      (value: any) => (value.body = "stale"),
      (value: any) => value.assets.push({ name: "conflict.tgz" }),
    ]) {
      const changed = clone(release);
      mutate(changed);
      assert.throws(() => validateExistingRelease(changed, expected), /metadata mismatch/);
    }
  });

  it("compares governance exactly and rejects each security-boundary drift", () => {
    assert.deepEqual(validateDesiredGovernance(desiredFixture), []);
    assert.equal(compareGovernance(desiredFixture, liveFixture).ok, true);
    const mutations: Array<(value: any) => void> = [
      (value) => {
        value.principals.environmentReviewers = [];
      },
      (value) => {
        value.principals.environmentReviewers[0] = value.principals.controlledTagActor;
      },
      (value) => {
        value.environment.preventSelfReview = false;
      },
      (value) => {
        value.environment.canAdminsBypass = true;
      },
      (value) => {
        value.environment.deploymentPolicy.branches = ["main"];
      },
      (value) => {
        value.releaseTagRulesets.immutability.bypassActors = [
          { id: 101, type: "Integration", mode: "always" },
        ];
      },
      (value) => {
        value.releaseTagRulesets.creation.bypassActors = [];
      },
      (value) => {
        value.releaseTagRulesets.creation.rules = [];
      },
      (value) => {
        value.mainRuleset.requiredStatusChecks = ["test"];
      },
      (value) => {
        value.mainRuleset.rules = value.mainRuleset.rules.filter(
          (rule: string) => rule !== "pull_request",
        );
      },
      (value) => {
        value.npmTrustedPublisher.workflowFilename = "other.yml";
      },
    ];
    for (const mutate of mutations) {
      const changed = clone(liveFixture);
      mutate(changed);
      assert.equal(compareGovernance(desiredFixture, changed).ok, false);
    }
  });

  it("rejects every main protection rule and security-critical parameter drift", () => {
    assert.deepEqual(validateDesiredGovernance(authoritativeDesiredFixture), []);
    const weakenedDesired = clone(authoritativeDesiredFixture);
    weakenedDesired.mainRuleset.rules = weakenedDesired.mainRuleset.rules.filter(
      (rule: string) => rule !== "code_scanning",
    );
    assert.notDeepEqual(validateDesiredGovernance(weakenedDesired), []);
    const weakenedParameters = clone(authoritativeDesiredFixture);
    const pullRequest = weakenedParameters.mainRuleset.ruleParameters.find(
      (item: any) => item.type === "pull_request",
    );
    assert.ok(pullRequest);
    pullRequest.parameters.required_review_thread_resolution = false;
    assert.notDeepEqual(validateDesiredGovernance(weakenedParameters), []);
    const weakenedContexts = clone(authoritativeDesiredFixture);
    const statusChecks = weakenedContexts.mainRuleset.ruleParameters.find(
      (item: any) => item.type === "required_status_checks",
    );
    assert.ok(statusChecks);
    statusChecks.parameters.required_status_checks.pop();
    assert.notDeepEqual(validateDesiredGovernance(weakenedContexts), []);
    const weakenedIdentity = clone(authoritativeDesiredFixture);
    weakenedIdentity.mainRuleset.enforcement = "disabled";
    assert.notDeepEqual(validateDesiredGovernance(weakenedIdentity), []);
    const weakenedMainRef = clone(authoritativeDesiredFixture);
    weakenedMainRef.mainRuleset.refPattern = "refs/heads/release";
    assert.notDeepEqual(validateDesiredGovernance(weakenedMainRef), []);
    const weakenedTagIdentity = clone(authoritativeDesiredFixture);
    weakenedTagIdentity.releaseTagRulesets.creation.refPattern = "refs/heads/main";
    assert.notDeepEqual(validateDesiredGovernance(weakenedTagIdentity), []);
    const weakenedTagEnforcement = clone(authoritativeDesiredFixture);
    weakenedTagEnforcement.releaseTagRulesets.immutability.enforcement = "evaluate";
    assert.notDeepEqual(validateDesiredGovernance(weakenedTagEnforcement), []);
    const weakenedExclusions = clone(authoritativeDesiredFixture);
    weakenedExclusions.mainRuleset.refExcludes = ["refs/heads/main"];
    assert.notDeepEqual(validateDesiredGovernance(weakenedExclusions), []);
    const weakenedEnvironment = clone(authoritativeDesiredFixture);
    weakenedEnvironment.environment.name = "preview";
    assert.notDeepEqual(validateDesiredGovernance(weakenedEnvironment), []);
    const mismatchedSubject = clone(authoritativeDesiredFixture);
    mismatchedSubject.npmTrustedPublisher.oidcSubject =
      "repo:other@267603464/repository@1339120262:environment:release";
    assert.notDeepEqual(validateDesiredGovernance(mismatchedSubject), []);
    assert.equal(
      compareGovernance(authoritativeDesiredFixture, authoritativeDesiredFixture).ok,
      true,
    );
    const reordered = clone(authoritativeDesiredFixture);
    reordered.mainRuleset.ruleParameters.reverse();
    assert.equal(compareGovernance(authoritativeDesiredFixture, reordered).ok, true);

    const reject = (mutate: (value: any) => void) => {
      const changed = clone(authoritativeDesiredFixture);
      mutate(changed);
      assert.equal(compareGovernance(authoritativeDesiredFixture, changed).ok, false);
    };
    for (const rule of authoritativeDesiredFixture.mainRuleset.rules) {
      reject((value) => {
        value.mainRuleset.rules = value.mainRuleset.rules.filter((item: string) => item !== rule);
      });
    }
    reject((value) => {
      value.mainRuleset.bypassActors = [{ id: 7, type: "Integration", mode: "always" }];
    });
    reject((value) => {
      value.mainRuleset.target = "tag";
    });
    reject((value) => {
      value.releaseTagRulesets.creation.target = "branch";
    });

    const parameterMutations: Array<[string, (parameters: any) => void]> = [
      [
        "required approving reviews",
        (parameters) => (parameters.required_approving_review_count = 1),
      ],
      ["dismiss stale reviews", (parameters) => (parameters.dismiss_stale_reviews_on_push = false)],
      ["required reviewers", (parameters) => (parameters.required_reviewers = [{ id: 7 }])],
      ["code-owner review", (parameters) => (parameters.require_code_owner_review = true)],
      ["last-push approval", (parameters) => (parameters.require_last_push_approval = true)],
      [
        "review-thread resolution",
        (parameters) => (parameters.required_review_thread_resolution = false),
      ],
      [
        "unattributed-change approval",
        (parameters) => (parameters.require_extra_approval_for_unattributed_changes = false),
      ],
      ["allowed merge methods", (parameters) => (parameters.allowed_merge_methods = ["merge"])],
      [
        "strict status checks",
        (parameters) => (parameters.strict_required_status_checks_policy = false),
      ],
      [
        "status-check creation enforcement",
        (parameters) => (parameters.do_not_enforce_on_create = true),
      ],
      [
        "required status context",
        (parameters) =>
          (parameters.required_status_checks = parameters.required_status_checks.slice(1)),
      ],
      [
        "CodeQL security threshold",
        (parameters) => (parameters.code_scanning_tools[0].security_alerts_threshold = "high"),
      ],
      [
        "CodeQL alert threshold",
        (parameters) => (parameters.code_scanning_tools[0].alerts_threshold = "high"),
      ],
      ["code quality severity", (parameters) => (parameters.severity = "high")],
      ["minimum coverage", (parameters) => (parameters.minimum_coverage = 80)],
      ["maximum coverage drop", (parameters) => (parameters.max_coverage_drop = 4)],
    ];
    for (const [label, mutateParameters] of parameterMutations) {
      reject((value) => {
        const type = label.includes("status")
          ? "required_status_checks"
          : label.includes("CodeQL")
            ? "code_scanning"
            : label.includes("quality")
              ? "code_quality"
              : label.includes("coverage")
                ? "code_coverage"
                : "pull_request";
        const rule = value.mainRuleset.ruleParameters.find((item: any) => item.type === type);
        assert.ok(rule, `${label}: rule parameter fixture missing`);
        mutateParameters(rule.parameters);
      });
    }
  });

  it("rejects raw live self-review bypasses and missing tag-creation bypass", () => {
    const raw = {
      rulesets: [],
      environment: {
        name: "release",
        protection_rules: [{ type: "required_reviewers", prevent_self_review: false }],
        can_admins_bypass: false,
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      },
      deploymentPolicies: [{ type: "tag", name: "v*" }],
    };
    const selfReviewResult = compareGovernance(authoritativeDesiredFixture, raw);
    assert.ok(selfReviewResult.errors.includes("release environment does not prevent self-review"));

    const missingBypass = clone(authoritativeDesiredFixture);
    missingBypass.releaseTagRulesets.creation.bypassActors = [];
    const bypassResult = compareGovernance(authoritativeDesiredFixture, missingBypass);
    assert.ok(bypassResult.errors.includes("creation tag bypass actors drifted"));
  });

  it("rejects missing live rulesets instead of copying desired rules", () => {
    const legacy = {
      rulesets: [],
      environment: {
        name: "release",
        prevent_self_review: true,
        can_admins_bypass: false,
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      },
      deploymentPolicies: [{ type: "tag", name: "v*" }],
    };
    const result = compareGovernance(desiredFixture, legacy);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("ruleset identity drifted")));
  });

  it("preserves excluded live refs in the normalized ruleset", () => {
    const expected = desiredFixture.releaseTagRulesets.creation;
    const raw = {
      rulesets: [
        {
          name: expected.name,
          enforcement: expected.enforcement,
          conditions: {
            ref_name: { include: [expected.refPattern], exclude: ["refs/tags/v2**"] },
          },
          rules: [{ type: "creation" }],
          bypass_actors: [],
        },
      ],
    };
    const normalized = normalizeLiveGovernance(raw, desiredFixture);
    assert.deepEqual(normalized.releaseTagRulesets.creation.refExcludes, ["refs/tags/v2**"]);
    assert.deepEqual(normalized.releaseTagRulesets.creation.refIncludes, [expected.refPattern]);
  });

  it("rejects an unsafe repository identity before calling external tools", () => {
    const desired = clone(desiredFixture);
    desired.repository.owner = "../other";
    assert.throws(
      () => collectLiveGovernance(desired, () => assert.fail("must not execute")),
      /repository identity is invalid/,
    );
  });

  it("skips the optional deployment-policy endpoint when custom policies are disabled", () => {
    const calls: string[] = [];
    const command = (binary: string, args: readonly string[]) => {
      const endpoint = args[1] ?? "";
      calls.push(`${binary} ${endpoint}`);
      if (binary === "npm") return "[]";
      if (endpoint.endsWith("/rulesets")) return "[]";
      if (endpoint.includes("/environments/release")) {
        return JSON.stringify({
          name: "release",
          deployment_branch_policy: {
            protected_branches: true,
            custom_branch_policies: false,
          },
        });
      }
      assert.fail(`unexpected command: ${binary} ${args.join(" ")}`);
    };

    const live = collectLiveGovernance(desiredFixture, command as never);
    assert.deepEqual(live.deploymentPolicies, []);
    assert.deepEqual(live.npmTrustedPublisher, { livePending: true });
    assert.equal(
      calls.some((call) => call.startsWith("npm ")),
      false,
    );
    assert.equal(
      calls.some((call) => call.includes("deployment-branch-policies")),
      false,
    );
  });

  it("keeps the governance audit manual, read-only, and honest about live status", () => {
    assert.ok(Object.hasOwn(governanceWorkflow.on, "workflow_dispatch"));
    assert.deepEqual(governanceWorkflow.permissions, { contents: "read" });
    assert.deepEqual(governanceWorkflow.jobs.audit.permissions, { contents: "read" });
    const run = governanceWorkflow.jobs.audit.steps
      .filter((step: any) => step.run)
      .map((step: any) => step.run)
      .join("\n");
    assert.match(run, /check-release-governance\.mjs/);
    assert.doesNotMatch(run, /(?:gh api|npm trust).*(?:--method|delete|create|edit|put|post)/i);
    const status = JSON.parse(
      readFileSync(path.join(repoRoot, "docs/release-governance-status.json"), "utf8"),
    );
    assert.equal(status.evidenceStatus, "point-in-time-verified");
    assert.equal(status.liveVerification, "partial");
    assert.ok(
      status.livePending.some(
        (item: { item: string }) =>
          item.item === "npm trusted-publisher repository, workflow, and environment identity",
      ),
    );
    const desired = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts/release-governance.json"), "utf8"),
    );
    assert.deepEqual(validateDesiredGovernance(desired), []);
  });

  it("parses the workflow graph and proves least-privilege job boundaries", () => {
    const jobs = workflow.jobs;
    assert.deepEqual(jobs.publish.needs, ["validate", "consumer", "publication-state"]);
    assert.deepEqual(jobs["registry-verify"].needs, [
      "validate",
      "consumer",
      "publication-state",
      "publish",
    ]);
    assert.deepEqual(jobs["github-release"].needs, ["validate", "registry-verify"]);
    assert.deepEqual(jobs.publish.permissions, { "id-token": "write" });
    const allJobs = Object.values(jobs) as any[];
    assert.equal(allJobs.filter((job) => job.permissions?.["id-token"] === "write").length, 1);
    for (const candidate of [workflow, ciWorkflow, recoveryWorkflow]) {
      for (const job of Object.values(candidate.jobs) as any[]) {
        for (const step of job.steps ?? []) {
          if (step.run) assert.doesNotMatch(step.run, /\$\{\{/);
        }
      }
    }
    const publishUses = jobs.publish.steps
      .filter((step: any) => step.uses)
      .map((step: any) => step.uses.split("@")[0]);
    assert.deepEqual(publishUses, ["actions/setup-node", "actions/download-artifact"]);
    const publishRuns = jobs.publish.steps
      .filter((step: any) => step.run)
      .map((step: any) => step.run)
      .join("\n");
    assert.match(publishRuns, /publish-release-package\.mjs/);
    assert.doesNotMatch(publishRuns, /npm (?:ci|install|publish)/);
    assert.doesNotMatch(publishRuns, /11\.5\.1/);
    assert.equal(
      jobs.consumer.strategy.matrix,
      "${{ fromJSON(needs.validate.outputs.compat_matrix) }}",
    );
    assert.match(jobs["github-release"].steps.at(-1).run, /--expected-commit "\$GITHUB_SHA"/);
    const argumentParsers = [
      "check-release-artifact.mjs",
      "check-release-governance.mjs",
      "check-trusted-publishing-npm.mjs",
      "create-github-release.mjs",
      "publish-release-package.mjs",
      "run-tests.mjs",
      "verify-published-package.mjs",
    ].map((file) => readFileSync(path.join(repoRoot, "scripts", file), "utf8"));
    assert.ok(argumentParsers.every((source) => !source.includes('startsWith("--")')));
    assert.doesNotMatch(
      readFileSync(path.join(repoRoot, "scripts/create-github-release.mjs"), "utf8"),
      /GH_BIN/,
    );
  });

  it("recovers only an already-published release after read-only verification", () => {
    assert.ok(Object.hasOwn(recoveryWorkflow.on, "workflow_dispatch"));
    assert.deepEqual(recoveryWorkflow.concurrency, {
      group: "recover-github-release-${{ inputs.version }}",
      "cancel-in-progress": false,
    });
    assert.deepEqual(recoveryWorkflow.permissions, { contents: "read" });
    assert.deepEqual(recoveryWorkflow.jobs.verify.permissions, { contents: "read" });
    assert.equal(recoveryWorkflow.jobs.recover.environment, undefined);
    assert.deepEqual(recoveryWorkflow.jobs.recover.permissions, { contents: "write" });
    assert.equal(
      recoveryWorkflow.jobs.recover.steps[0].with.ref,
      "${{ needs.verify.outputs.commit }}",
    );
    const run = Object.values(recoveryWorkflow.jobs)
      .flatMap((job: any) => job.steps ?? [])
      .filter((step: any) => step.run)
      .map((step: any) => step.run)
      .join("\n");
    assert.match(run, /verify-published-package\.mjs/);
    assert.match(run, /create-github-release\.mjs/);
    assert.doesNotMatch(run, /npm publish|create-release-tag\.mjs/);
  });

  it("retries only typed transient failures within attempts and deadline", async () => {
    let clock = 0;
    const sleeps: number[] = [];
    let attempts = 0;
    const result = await retryBounded(
      async () => {
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error("temporary"), { status: 503 });
        return "ready";
      },
      {
        timeoutMs: 100,
        maxAttempts: 4,
        initialDelayMs: 10,
        maxDelayMs: 20,
        now: () => clock,
        sleep: async (ms) => {
          sleeps.push(ms);
          clock += ms;
        },
      },
    );
    assert.equal(result, "ready");
    assert.deepEqual(sleeps, [10, 20]);
    assert.equal(isTransientRegistryError(Object.assign(new Error("text says 503"), {})), false);
    assert.equal(
      isTransientRegistryError(Object.assign(new Error("forbidden"), { status: 403 })),
      false,
    );
    for (const code of ["E502", "E503", "E504"]) {
      assert.throws(
        () =>
          parseNpmCommandResult(
            { status: 1, signal: null, stdout: JSON.stringify({ error: { code } }), stderr: "" },
            "npm view",
          ),
        (error: any) => error.code === code && isTransientRegistryError(error),
      );
    }
    for (const code of ["E502", "E503", "E504"]) {
      let npmAttempts = 0;
      const npmSleeps: number[] = [];
      const value = await retryBounded(
        async () => {
          npmAttempts += 1;
          if (npmAttempts < 2)
            return parseNpmCommandResult(
              {
                status: 1,
                signal: null,
                stdout: JSON.stringify({ error: { code } }),
                stderr: "",
              },
              "npm view",
            );
          return { ok: true };
        },
        {
          timeoutMs: 100,
          maxAttempts: 3,
          initialDelayMs: 10,
          maxDelayMs: 10,
          now: () => 0,
          sleep: async (ms) => {
            npmSleeps.push(ms);
          },
        },
      );
      assert.deepEqual(value, { ok: true });
      assert.equal(npmAttempts, 2);
      assert.deepEqual(npmSleeps, [10]);
    }
    await assert.rejects(
      retryBounded(
        async () => {
          throw Object.assign(new Error("integrity"), { code: "EINTEGRITY" });
        },
        {
          timeoutMs: 100,
          maxAttempts: 3,
          initialDelayMs: 10,
          sleep: async () => assert.fail("must not sleep"),
        },
      ),
      /integrity/,
    );
  });

  it("classifies only structured npm failures and parses both Retry-After forms", () => {
    assert.throws(
      () =>
        parseNpmCommandResult(
          { status: 1, signal: null, stdout: '{"error":{"code":"E404"}}', stderr: "" },
          "npm view",
        ),
      (error: any) => error.code === "E404" && error.status === 404,
    );
    assert.throws(
      () =>
        parseNpmCommandResult(
          { status: 1, signal: null, stdout: "", stderr: "text says E404" },
          "npm view",
        ),
      (error: any) => error.code === undefined && error.status === undefined,
    );
    assert.equal(
      parseRetryAfterMs("3", () => 0),
      3000,
    );
    assert.equal(
      parseRetryAfterMs("Thu, 01 Jan 1970 00:00:05 GMT", () => 1000),
      4000,
    );
    assert.equal(
      parseRetryAfterMs("bad", () => 0),
      undefined,
    );
  });

  it("uses a fresh consumer for each transient registry install attempt", async () => {
    const directories: string[] = [];
    let calls = 0;
    const result = await verifyInstallWithRetry("pkg", "2.0.0", {
      timeoutMs: 100,
      maxAttempts: 2,
      initialDelayMs: 1,
      sleep: async () => {},
      install: (_command: string, _args: string[], options: { cwd: string }) => {
        directories.push(options.cwd);
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      },
      importPackage: async () => ({}),
    });
    assert.equal(result.attempts, 2);
    assert.equal(new Set(directories).size, 2);
  });

  it("accepts only the canonical npm attestation endpoint and rejects redirects", async () => {
    const url = "https://registry.npmjs.org/-/npm/v1/attestations/pkg@2.0.0";
    const view = {
      dist: {
        attestations: [{ url, provenance: { predicateType: "https://slsa.dev/provenance/v1" } }],
      },
    };
    assert.equal(canonicalAttestationUrl(view, "pkg", "2.0.0"), url);
    assert.equal(
      canonicalAttestationUrl(
        {
          dist: {
            attestations: { url, provenance: { predicateType: "https://slsa.dev/provenance/v1" } },
          },
        },
        "pkg",
        "2.0.0",
      ),
      url,
    );
    assert.throws(
      () =>
        canonicalAttestationUrl(
          {
            dist: {
              attestations: [
                {
                  url: "https://evil.test/x",
                  provenance: { predicateType: "https://slsa.dev/provenance/v1" },
                },
              ],
            },
          },
          "pkg",
          "2.0.0",
        ),
      /canonical/,
    );
    await assert.rejects(
      fetchAttestations(
        view,
        "pkg",
        "2.0.0",
        async () => ({ status: 302, ok: false, url, headers: { get: () => null } }) as any,
      ),
      /redirected/,
    );
  });
});

async function signedProvenanceFixture() {
  const fixed = new Date();
  const caKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const signerKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const ca = await initializeCA(caKeys, undefined, fixed);
  const expected = {
    name: "oxc-plugin-servicenow",
    version: "2.0.0-rc.1",
    integrity: `sha512-${Buffer.from("11".repeat(64), "hex").toString("base64")}`,
    repository: "https://github.com/martinthommesen/oxc-plugin-servicenow",
    workflow: ".github/workflows/release.yml",
    environment: "release",
    ref: "refs/tags/v2.0.0-rc.1",
    commit: "a".repeat(40),
    oidcSubject:
      "repo:martinthommesen@267603464/oxc-plugin-servicenow@1339120262:environment:release",
  };
  const workflowIdentity = `${expected.repository}/${expected.workflow}@${expected.ref}`;
  const oidValues: Record<string, string> = {
    "1.3.6.1.4.1.57264.1.8": "https://token.actions.githubusercontent.com",
    "1.3.6.1.4.1.57264.1.9": workflowIdentity,
    "1.3.6.1.4.1.57264.1.11": "github-hosted",
    "1.3.6.1.4.1.57264.1.12": expected.repository,
    "1.3.6.1.4.1.57264.1.13": expected.commit,
    "1.3.6.1.4.1.57264.1.14": expected.ref,
    "1.3.6.1.4.1.57264.1.18": workflowIdentity,
    "1.3.6.1.4.1.57264.1.20": "push",
    "1.3.6.1.4.1.57264.1.23": expected.environment,
    "1.3.6.1.4.1.57264.1.24": expected.oidcSubject,
  };
  const leaf = await ca.issueCertificate({
    publicKey: signerKeys.publicKey.export({ format: "der", type: "spki" }),
    subjectAltName: workflowIdentity,
    extensions: Object.entries(oidValues).map(([oid, value]) => ({
      oid,
      value,
    })),
  });
  const digestHex = Buffer.from(expected.integrity.slice("sha512-".length), "base64").toString(
    "hex",
  );
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      { name: `pkg:npm/${expected.name}@${expected.version}`, digest: { sha512: digestHex } },
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: { ref: expected.ref, repository: expected.repository, path: expected.workflow },
        },
        resolvedDependencies: [
          {
            uri: `git+${expected.repository}@${expected.ref}`,
            digest: { gitCommit: expected.commit },
          },
        ],
      },
      runDetails: { builder: { id: "https://github.com/actions/runner/github-hosted" } },
    },
  };
  const payload = Buffer.from(JSON.stringify(statement));
  const payloadType = "application/vnd.in-toto+json";
  const signature = sign(
    "sha256",
    dsse.preAuthEncoding(payloadType, payload),
    signerKeys.privateKey,
  );
  const bundle = {
    dsseEnvelope: {
      payload: payload.toString("base64"),
      payloadType,
      signatures: [{ sig: signature.toString("base64"), keyid: "" }],
    },
  };
  const rootCert = X509Certificate.parse(
    Buffer.from(
      ca.rootCertificate.buffer,
      ca.rootCertificate.byteOffset,
      ca.rootCertificate.byteLength,
    ),
  );
  const leafCert = X509Certificate.parse(
    Buffer.from(leaf.buffer, leaf.byteOffset, leaf.byteLength),
  );
  const trustMaterial = {
    certificateAuthorities: [
      {
        certChain: [rootCert],
        validFor: {
          start: new Date(fixed.getTime() - 1000),
          end: new Date(fixed.getTime() + 1000),
        },
      },
    ],
    timestampAuthorities: [],
    tlogs: [],
    ctlogs: [],
    publicKey: () => {
      throw new Error("unexpected public key");
    },
  };
  const verifier = new Verifier(trustMaterial, {
    ctlogThreshold: 0,
    tlogThreshold: 0,
    timestampThreshold: 1,
  });
  const verifyBundle = async (candidate: any, options: any) => {
    const envelopePayload = Buffer.from(candidate.dsseEnvelope.payload, "base64");
    const envelopeSignature = Buffer.from(candidate.dsseEnvelope.signatures[0].sig, "base64");
    const preAuth = dsse.preAuthEncoding(candidate.dsseEnvelope.payloadType, envelopePayload);
    const entity = {
      key: { $case: "certificate" as const, certificate: leafCert },
      timestamps: [
        {
          $case: "transparency-log" as const,
          tlogEntry: {
            inclusionPromise: {},
            logId: { keyId: Buffer.alloc(32) },
            integratedTime: String(fixed.getTime() / 1000),
          },
        },
      ],
      tlogEntries: [],
      signature: {
        signature: envelopeSignature,
        compareSignature: (value: Buffer) => value.equals(envelopeSignature),
        compareDigest: (value: Buffer) =>
          value.equals(createHash("sha256").update(envelopePayload).digest()),
        verifySignature: (key: any) => sigstoreCrypto.verify(preAuth, key, envelopeSignature),
      },
    };
    const policy = {
      subjectAlternativeName: options.certificateIdentityURI,
      extensions: { issuer: options.certificateIssuer },
    };
    return verifier.verify(entity as unknown as Parameters<typeof verifier.verify>[0], policy);
  };
  const resign = (response: any) => {
    const envelope = response.attestations[0].bundle.dsseEnvelope;
    const nextPayload = Buffer.from(envelope.payload, "base64");
    envelope.signatures[0].sig = sign(
      "sha256",
      dsse.preAuthEncoding(envelope.payloadType, nextPayload),
      signerKeys.privateKey,
    ).toString("base64");
  };
  return {
    response: { attestations: [{ predicateType: "https://slsa.dev/provenance/v1", bundle }] },
    expected,
    verifyBundle,
    resign,
  };
}

describe("exact Sigstore provenance", () => {
  it("cryptographically verifies a local trust-root fixture", async () => {
    const fixture = await signedProvenanceFixture();
    const summary = await verifyProvenanceAttestation(
      fixture.response,
      fixture.expected,
      fixture.verifyBundle,
    );
    assert.equal(summary.commit, fixture.expected.commit);
    assert.equal(summary.environment, "release");
    assert.match(summary.bundleSha256 ?? "", /^[a-f0-9]{64}$/);
  });

  it("rejects signature and every required statement or certificate identity mutation", async () => {
    const fixture = await signedProvenanceFixture();
    const mutations: Array<(response: any, expected: any) => void> = [
      (response) => {
        response.attestations[0].bundle.dsseEnvelope.signatures[0].sig =
          Buffer.alloc(72).toString("base64");
      },
      (response) => {
        const value = JSON.parse(
          Buffer.from(response.attestations[0].bundle.dsseEnvelope.payload, "base64").toString(),
        );
        value.subject[0].name = "pkg:npm/other@2.0.0";
        response.attestations[0].bundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(value),
        ).toString("base64");
      },
      (response) => {
        const value = JSON.parse(
          Buffer.from(response.attestations[0].bundle.dsseEnvelope.payload, "base64").toString(),
        );
        value.subject[0].digest.sha512 = "00";
        response.attestations[0].bundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(value),
        ).toString("base64");
      },
      (response) => {
        const value = JSON.parse(
          Buffer.from(response.attestations[0].bundle.dsseEnvelope.payload, "base64").toString(),
        );
        value.predicate.buildDefinition.externalParameters.workflow.repository =
          "https://github.com/evil/repo";
        response.attestations[0].bundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(value),
        ).toString("base64");
      },
      (response) => {
        const value = JSON.parse(
          Buffer.from(response.attestations[0].bundle.dsseEnvelope.payload, "base64").toString(),
        );
        value.predicate.buildDefinition.externalParameters.workflow.path =
          ".github/workflows/evil.yml";
        response.attestations[0].bundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(value),
        ).toString("base64");
      },
      (response) => {
        const value = JSON.parse(
          Buffer.from(response.attestations[0].bundle.dsseEnvelope.payload, "base64").toString(),
        );
        value.predicate.buildDefinition.externalParameters.workflow.ref = "refs/heads/main";
        response.attestations[0].bundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(value),
        ).toString("base64");
      },
      (response) => {
        const value = JSON.parse(
          Buffer.from(response.attestations[0].bundle.dsseEnvelope.payload, "base64").toString(),
        );
        value.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit = "b".repeat(40);
        response.attestations[0].bundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(value),
        ).toString("base64");
      },
      (_response, expected) => {
        expected.environment = "other";
      },
      (_response, expected) => {
        expected.oidcSubject = "repo:other@1/repo@2:environment:release";
      },
      (_response, expected) => {
        expected.repository = "https://github.com/other/repo";
      },
      (_response, expected) => {
        expected.workflow = ".github/workflows/other.yml";
      },
      (_response, expected) => {
        expected.ref = "refs/tags/v9.9.9";
      },
      (_response, expected) => {
        expected.commit = "b".repeat(40);
      },
    ];
    for (const [index, mutate] of mutations.entries()) {
      const response = clone(fixture.response);
      const expected = clone(fixture.expected);
      mutate(response, expected);
      if (index > 0 && index < 7) fixture.resign(response);
      await assert.rejects(verifyProvenanceAttestation(response, expected, fixture.verifyBundle));
    }
  });
});
