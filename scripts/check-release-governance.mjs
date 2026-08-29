import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

function sorted(values) {
  return [...values].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function same(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
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
  if (
    !same(immutable?.rules ?? [], ["deletion", "non_fast_forward"]) ||
    (immutable?.bypassActors?.length ?? 0) !== 0
  )
    errors.push("tag immutability ruleset must have deletion/non-fast-forward and no bypass");
  if (
    !same(creation?.rules ?? [], ["creation"]) ||
    creation?.bypassActors?.length !== 1 ||
    creation.bypassActors[0]?.id !== actor?.id ||
    creation.bypassActors[0]?.type !== actor?.type ||
    creation.bypassActors[0]?.mode !== "always"
  )
    errors.push("tag creation ruleset must allow only the controlled actor");
  if (!/^repo:[^:]+:environment:release$/.test(desired?.npmTrustedPublisher?.oidcSubject ?? ""))
    errors.push("environment-bound npm OIDC subject is not configured");
  return errors;
}

function rulesetSummary(value) {
  return {
    name: value?.name,
    enforcement: value?.enforcement,
    refPattern: value?.conditions?.ref_name?.include?.[0],
    rules: (value?.rules ?? []).map((item) => item.type),
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
  const policies = raw.deploymentPolicies ?? [];
  return {
    schemaVersion: 2,
    repository: desired.repository,
    principals: {
      controlledTagActor: desired.principals.controlledTagActor,
      // The environments API nests reviewers inside the required_reviewers
      // protection rule; a bare `reviewers` array only appears in fixtures.
      environmentReviewers: (
        environment.protection_rules?.find((item) => item.type === "required_reviewers")
          ?.reviewers ??
        environment.reviewers ??
        []
      ).map((item) => ({
        id: item.reviewer?.id,
        type: item.type,
        login: item.reviewer?.login ?? item.reviewer?.name,
      })),
    },
    environment: {
      name: environment.name,
      preventSelfReview:
        environment.protection_rules?.find((item) => item.type === "required_reviewers")
          ?.prevent_self_review ?? environment.prevent_self_review,
      canAdminsBypass: environment.can_admins_bypass,
      deploymentPolicy: {
        protectedBranches: environment.deployment_branch_policy?.protected_branches,
        customBranchPolicies: environment.deployment_branch_policy?.custom_branch_policies,
        branches: policies.filter((item) => item.type === "branch").map((item) => item.name),
        tags: policies.filter((item) => item.type === "tag").map((item) => item.name),
      },
    },
    mainRuleset: { ...desired.mainRuleset, ...byName(desired.mainRuleset.name) },
    releaseTagRulesets: {
      immutability: {
        ...desired.releaseTagRulesets.immutability,
        ...byName(desired.releaseTagRulesets.immutability.name),
      },
      creation: {
        ...desired.releaseTagRulesets.creation,
        ...byName(desired.releaseTagRulesets.creation.name),
      },
    },
    npmTrustedPublisher: {
      ...desired.npmTrustedPublisher,
      type: raw.npmTrustedPublisher?.type,
      repository: raw.npmTrustedPublisher?.repository,
      workflowFilename: raw.npmTrustedPublisher?.file ?? raw.npmTrustedPublisher?.workflowFilename,
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
        actual?.refPattern === expected.refPattern,
      `${key} tag ruleset identity drifted`,
    );
    check(same(actual?.rules ?? [], expected.rules), `${key} tag rules drifted`);
    check(
      same(actual?.bypassActors ?? [], expected.bypassActors),
      `${key} tag bypass actors drifted`,
    );
  }
  check(
    live.mainRuleset?.name === desired.mainRuleset.name &&
      live.mainRuleset?.enforcement === "active" &&
      live.mainRuleset?.refPattern === desired.mainRuleset.refPattern,
    "main ruleset identity drifted",
  );
  check(
    same(live.mainRuleset?.requiredStatusChecks ?? [], desired.mainRuleset.requiredStatusChecks),
    "main required status checks drifted",
  );
  for (const field of ["type", "repository", "workflowFilename", "environment"])
    check(
      live.npmTrustedPublisher?.[field] === desired.npmTrustedPublisher[field],
      `npm trusted publisher ${field} drifted`,
    );
  return {
    ok: errors.length === 0,
    errors,
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
  const deploymentPolicies =
    gh(`repos/${repository}/environments/${desired.environment.name}/deployment-branch-policies`)
      .branch_policies ?? [];
  const trust = parseJson(
    command("npm", ["trust", "list", desired.repository.name, "--json"], { encoding: "utf8" }),
    "npm trust list",
  );
  const publisher = Array.isArray(trust) ? trust[0] : trust;
  return { rulesets, environment, deploymentPolicies, npmTrustedPublisher: publisher };
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
