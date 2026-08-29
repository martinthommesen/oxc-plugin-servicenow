import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_MAIN_RULE_TYPES = [
  "deletion",
  "non_fast_forward",
  "pull_request",
  "required_status_checks",
  "code_scanning",
  "code_quality",
  "code_coverage",
  "required_linear_history",
];
const EXPECTED_MAIN_STATUS_CHECKS = [
  "test",
  "consumer",
  "bench",
  "compat (min-hosts, 20.19.0)",
  "compat (node22-host, 22.14.0)",
  "compat (node24-host, 24.16.0)",
  "compat (node26-host, 26.7.0)",
  "compat (eslint9-current, 24.16.0)",
  "docs",
  "manifest",
  "artifact",
  "workflow",
];
const EXPECTED_MAIN_RULE_PARAMETERS = [
  { type: "deletion", parameters: null },
  { type: "non_fast_forward", parameters: null },
  {
    type: "pull_request",
    parameters: {
      required_approving_review_count: 0,
      dismiss_stale_reviews_on_push: true,
      required_reviewers: [],
      require_code_owner_review: false,
      require_last_push_approval: false,
      required_review_thread_resolution: true,
      require_extra_approval_for_unattributed_changes: true,
      allowed_merge_methods: ["squash", "rebase"],
    },
  },
  {
    type: "required_status_checks",
    parameters: {
      strict_required_status_checks_policy: true,
      do_not_enforce_on_create: false,
      required_status_checks: EXPECTED_MAIN_STATUS_CHECKS.map((context) => ({ context })),
    },
  },
  {
    type: "code_scanning",
    parameters: {
      code_scanning_tools: [
        { tool: "CodeQL", security_alerts_threshold: "all", alerts_threshold: "all" },
      ],
    },
  },
  { type: "code_quality", parameters: { severity: "all" } },
  { type: "code_coverage", parameters: { minimum_coverage: 85, max_coverage_drop: 3 } },
  { type: "required_linear_history", parameters: null },
];

function fail(message) {
  const error = new Error(message);
  error.kind = "release-governance";
  throw error;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) fail(`${name} requires a value`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value))
    return value
      .map(canonical)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function positiveId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateDesiredGovernance(desired) {
  const errors = [];
  const actor = desired?.principals?.controlledTagActor;
  const reviewers = desired?.principals?.environmentReviewers;
  if (desired?.schemaVersion !== 2) errors.push("schemaVersion must be 2");
  if (
    !/^[A-Za-z0-9_.-]+$/.test(desired?.repository?.owner ?? "") ||
    !/^[A-Za-z0-9_.-]+$/.test(desired?.repository?.name ?? "")
  )
    errors.push("repository identity is invalid");
  if (!positiveId(actor?.id) || !["Integration", "Team", "RepositoryRole"].includes(actor?.type))
    errors.push("controlled tag actor is not configured with a stable ID and type");
  if (
    !Array.isArray(reviewers) ||
    reviewers.length === 0 ||
    reviewers.some((item) => !positiveId(item?.id))
  )
    errors.push("at least one independent reviewer stable ID is required");
  if (
    Array.isArray(reviewers) &&
    reviewers.some((item) => item.id === actor?.id && item.type === actor?.type)
  )
    errors.push("tag actor and environment reviewer must be distinct");
  if (
    desired?.environment?.name !== "release" ||
    desired?.environment?.preventSelfReview !== true ||
    desired?.environment?.canAdminsBypass !== false
  )
    errors.push("release environment review protections are incomplete");
  const policy = desired?.environment?.deploymentPolicy;
  if (
    policy?.protectedBranches !== false ||
    policy?.customBranchPolicies !== true ||
    !same(policy?.branches ?? [], []) ||
    !same(policy?.tags ?? [], ["v*"])
  )
    errors.push("release environment must permit only custom v* tag deployments");
  const immutable = desired?.releaseTagRulesets?.immutability;
  const creation = desired?.releaseTagRulesets?.creation;
  const main = desired?.mainRuleset;
  if (
    main?.enforcement !== "active" ||
    main?.target !== "branch" ||
    main?.refPattern !== "refs/heads/main" ||
    !same(main?.refIncludes ?? [main?.refPattern], ["refs/heads/main"]) ||
    !same(main?.refExcludes ?? [], []) ||
    (main?.bypassActors?.length ?? 0) !== 0 ||
    !same(main?.rules ?? [], EXPECTED_MAIN_RULE_TYPES) ||
    !same(main?.requiredStatusChecks ?? [], EXPECTED_MAIN_STATUS_CHECKS) ||
    !same(main?.ruleParameters ?? [], EXPECTED_MAIN_RULE_PARAMETERS)
  )
    errors.push("main ruleset must target branches and have no bypass actors");
  if (
    immutable?.enforcement !== "active" ||
    !same(immutable?.rules ?? [], ["deletion", "non_fast_forward"]) ||
    immutable?.target !== "tag" ||
    immutable?.refPattern !== "refs/tags/v**" ||
    !same(immutable?.refIncludes ?? [immutable?.refPattern], ["refs/tags/v**"]) ||
    !same(immutable?.refExcludes ?? [], []) ||
    (immutable?.bypassActors?.length ?? 0) !== 0
  )
    errors.push("tag immutability ruleset must have deletion/non-fast-forward and no bypass");
  if (
    creation?.enforcement !== "active" ||
    !same(creation?.rules ?? [], ["creation"]) ||
    creation?.target !== "tag" ||
    creation?.refPattern !== "refs/tags/v**" ||
    !same(creation?.refIncludes ?? [creation?.refPattern], ["refs/tags/v**"]) ||
    !same(creation?.refExcludes ?? [], []) ||
    creation?.bypassActors?.length !== 1 ||
    creation.bypassActors[0]?.id !== actor?.id ||
    creation.bypassActors[0]?.type !== actor?.type ||
    creation.bypassActors[0]?.mode !== "always"
  )
    errors.push("tag creation ruleset must allow only the controlled actor");
  const oidcSubject = /^repo:([^/@:]+)@\d+\/([^/@:]+)@\d+:environment:release$/.exec(
    desired?.npmTrustedPublisher?.oidcSubject ?? "",
  );
  if (
    !oidcSubject ||
    oidcSubject[1] !== desired?.repository?.owner ||
    oidcSubject[2] !== desired?.repository?.name
  )
    errors.push("environment-bound npm OIDC subject is not configured");
  return errors;
}

function rulesetSummary(value) {
  return {
    name: value?.name,
    enforcement: value?.enforcement,
    target: value?.target,
    refPattern: value?.conditions?.ref_name?.include?.[0],
    refIncludes: value?.conditions?.ref_name?.include ?? [],
    refExcludes: value?.conditions?.ref_name?.exclude ?? [],
    rules: (value?.rules ?? []).map((item) => item.type),
    ruleParameters: (value?.rules ?? []).map((item) => ({
      type: item.type,
      parameters: canonical(item.parameters ?? null),
    })),
    bypassActors: (value?.bypass_actors ?? []).map((item) => ({
      id: item.actor_id,
      type: item.actor_type,
      mode: item.bypass_mode,
    })),
    requiredStatusChecks:
      (value?.rules ?? [])
        .find((item) => item.type === "required_status_checks")
        ?.parameters?.required_status_checks?.map((item) => item.context) ?? [],
  };
}

export function normalizeLiveGovernance(raw, desired) {
  if (raw?.schemaVersion === 2 && raw?.environment?.deploymentPolicy) return raw;
  const rulesets = (raw.rulesets ?? []).map(rulesetSummary);
  const byName = (name) => rulesets.find((item) => item.name === name);
  const environment = raw.environment ?? {};
  const reviewerRule = environment.protection_rules?.find(
    (item) => item.type === "required_reviewers",
  );
  const policies = raw.deploymentPolicies ?? [];
  return {
    schemaVersion: 2,
    repository: desired.repository,
    principals: {
      controlledTagActor: desired.principals.controlledTagActor,
      environmentReviewers: (environment.reviewers ?? reviewerRule?.reviewers ?? []).map(
        (item) => ({
          id: item.reviewer?.id,
          type: item.type,
          login: item.reviewer?.login ?? item.reviewer?.name,
        }),
      ),
    },
    environment: {
      name: environment.name,
      preventSelfReview: reviewerRule?.prevent_self_review ?? environment.prevent_self_review,
      canAdminsBypass: environment.can_admins_bypass,
      deploymentPolicy: {
        protectedBranches: environment.deployment_branch_policy?.protected_branches,
        customBranchPolicies: environment.deployment_branch_policy?.custom_branch_policies,
        branches: policies.filter((item) => item.type === "branch").map((item) => item.name),
        tags: policies.filter((item) => item.type === "tag").map((item) => item.name),
      },
    },
    mainRuleset: byName(desired.mainRuleset.name),
    releaseTagRulesets: {
      immutability: byName(desired.releaseTagRulesets.immutability.name),
      creation: byName(desired.releaseTagRulesets.creation.name),
    },
    npmTrustedPublisher:
      raw.npmTrustedPublisher?.livePending === true
        ? { livePending: true }
        : {
            ...desired.npmTrustedPublisher,
            type: raw.npmTrustedPublisher?.type,
            repository: raw.npmTrustedPublisher?.repository,
            workflowFilename:
              raw.npmTrustedPublisher?.file ?? raw.npmTrustedPublisher?.workflowFilename,
            environment: raw.npmTrustedPublisher?.environment,
          },
  };
}

export function compareGovernance(desired, liveInput) {
  const errors = validateDesiredGovernance(desired);
  const live = normalizeLiveGovernance(liveInput, desired);
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };
  check(live.environment?.name === desired.environment.name, "release environment name drifted");
  check(
    live.environment?.preventSelfReview === true,
    "release environment does not prevent self-review",
  );
  check(
    live.environment?.canAdminsBypass === false,
    "release environment permits administrator bypass",
  );
  check(
    JSON.stringify(live.environment?.deploymentPolicy) ===
      JSON.stringify(desired.environment.deploymentPolicy),
    "release environment deployment policy drifted",
  );
  check(
    same(live.principals?.environmentReviewers ?? [], desired.principals.environmentReviewers),
    "release environment reviewers drifted",
  );
  for (const key of ["immutability", "creation"]) {
    const expected = desired.releaseTagRulesets[key];
    const actual = live.releaseTagRulesets?.[key];
    check(
      actual?.name === expected.name &&
        actual?.enforcement === expected.enforcement &&
        actual?.target === expected.target &&
        actual?.refPattern === expected.refPattern &&
        same(
          actual?.refIncludes ?? [actual?.refPattern],
          expected.refIncludes ?? [expected.refPattern],
        ) &&
        same(actual?.refExcludes ?? [], expected.refExcludes ?? []),
      `${key} tag ruleset identity drifted`,
    );
    check(same(actual?.rules ?? [], expected.rules), `${key} tag rules drifted`);
    if (expected.ruleParameters)
      check(
        same(actual?.ruleParameters ?? [], expected.ruleParameters),
        `${key} tag rule parameters drifted`,
      );
    check(
      same(actual?.bypassActors ?? [], expected.bypassActors),
      `${key} tag bypass actors drifted`,
    );
  }
  check(
    live.mainRuleset?.name === desired.mainRuleset.name &&
      live.mainRuleset?.enforcement === "active" &&
      live.mainRuleset?.target === desired.mainRuleset.target &&
      live.mainRuleset?.refPattern === desired.mainRuleset.refPattern &&
      same(
        live.mainRuleset?.refIncludes ?? [live.mainRuleset?.refPattern],
        desired.mainRuleset.refIncludes ?? [desired.mainRuleset.refPattern],
      ) &&
      same(live.mainRuleset?.refExcludes ?? [], desired.mainRuleset.refExcludes ?? []),
    "main ruleset identity drifted",
  );
  check(
    same(live.mainRuleset?.requiredStatusChecks ?? [], desired.mainRuleset.requiredStatusChecks),
    "main required status checks drifted",
  );
  check(
    same(live.mainRuleset?.rules ?? [], desired.mainRuleset.rules ?? []),
    "main required protection rules drifted",
  );
  check(
    same(live.mainRuleset?.bypassActors ?? [], desired.mainRuleset.bypassActors ?? []),
    "main ruleset bypass actors drifted",
  );
  if (desired.mainRuleset.ruleParameters)
    check(
      same(live.mainRuleset?.ruleParameters ?? [], desired.mainRuleset.ruleParameters),
      "main rule parameters drifted",
    );
  const npmPublisherPending = live.npmTrustedPublisher?.livePending === true;
  if (!npmPublisherPending)
    for (const field of ["type", "repository", "workflowFilename", "environment"])
      check(
        live.npmTrustedPublisher?.[field] === desired.npmTrustedPublisher[field],
        `npm trusted publisher ${field} drifted`,
      );
  return {
    ok: errors.length === 0,
    errors,
    livePending: npmPublisherPending ? ["npm trusted-publisher identity"] : [],
    repository: `${desired.repository.owner}/${desired.repository.name}`,
    environment: desired.environment.name,
  };
}

function parseJson(raw, label) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") fail(`${label} returned no JSON object`);
    return parsed;
  } catch (error) {
    if (error?.kind === "release-governance") throw error;
    fail(`${label} returned malformed JSON`);
  }
}

export function collectLiveGovernance(desired, command = execFileSync) {
  if (
    !/^[A-Za-z0-9_.-]+$/.test(desired?.repository?.owner ?? "") ||
    !/^[A-Za-z0-9_.-]+$/.test(desired?.repository?.name ?? "")
  ) {
    fail("repository identity is invalid");
  }
  const repository = `${desired.repository.owner}/${desired.repository.name}`;
  const gh = (endpoint) =>
    parseJson(command("gh", ["api", endpoint], { encoding: "utf8" }), `gh api ${endpoint}`);
  const summaries = gh(`repos/${repository}/rulesets`);
  const rulesets = summaries.map((item) => gh(`repos/${repository}/rulesets/${item.id}`));
  const environment = gh(`repos/${repository}/environments/${desired.environment.name}`);
  const deploymentPolicies = environment.deployment_branch_policy?.custom_branch_policies
    ? (gh(`repos/${repository}/environments/${desired.environment.name}/deployment-branch-policies`)
        .branch_policies ?? [])
    : [];
  return {
    rulesets,
    environment,
    deploymentPolicies,
    npmTrustedPublisher: { livePending: true },
  };
}

export function main(argv = process.argv) {
  const desiredPath = argValue(argv, "--desired") ?? join(root, "scripts/release-governance.json");
  const desired = parseJson(
    readFileSync(isAbsolute(desiredPath) ? desiredPath : join(process.cwd(), desiredPath), "utf8"),
    "desired governance",
  );
  const fixture = argValue(argv, "--fixture");
  const live = fixture
    ? parseJson(
        readFileSync(isAbsolute(fixture) ? fixture : join(process.cwd(), fixture), "utf8"),
        "governance fixture",
      )
    : collectLiveGovernance(desired);
  const result = compareGovernance(desired, live);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
