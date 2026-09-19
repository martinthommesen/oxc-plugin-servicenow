import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_ARTIFACT_PATHS } from "./lib/generated-artifacts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function generatedArtifactStatus() {
  return execFileSync(
    "git",
    [
      "-c",
      "core.fsmonitor=false",
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--",
      ...GENERATED_ARTIFACT_PATHS,
    ],
    { cwd: root, encoding: "utf8" },
  ).trim();
}

const status = generatedArtifactStatus();
if (status) {
  console.error(`generated files differ from the checked-in set:\n${status}`);
  process.exit(1);
}
