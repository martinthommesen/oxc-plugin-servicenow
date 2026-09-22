import { GENERATED_ARTIFACT_PATHS } from "./lib/generated-artifacts.mjs";
import { git } from "./lib/git.mjs";

export function generatedArtifactStatus() {
  return git([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...GENERATED_ARTIFACT_PATHS,
  ]).trim();
}

const status = generatedArtifactStatus();
if (status) {
  console.error(`generated files differ from the checked-in set:\n${status}`);
  process.exit(1);
}
