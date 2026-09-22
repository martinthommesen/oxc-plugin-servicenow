---
applyTo: ".github/workflows/**,scripts/**,scripts/release-governance.json,.coderabbit.yaml"
---

# Workflows, scripts, and governance

- Every action is pinned to a full commit SHA recorded in `scripts/action-pins.json`; `npm run workflow:check` enforces it. Flag a tag or branch reference.
- Jobs hold the least permission they need. `persist-credentials: false` on every checkout. The publish job has only `id-token: write`, checks out no source, and installs nothing.
- The release tarball is built once in `validate` and consumed by every later job; no job rebuilds. Registry-installed package code runs only after the tarball is immutable.
- `scripts/release-governance.json` is the desired policy and the audit in `scripts/check-release-governance.mjs` compares it with live GitHub settings. A change to either is a security change; check that `docs/release.md` describes the new policy and that the audit still rejects reviewer, bypass, and tag-creation drift.
- Scripts are checked by `tsconfig.scripts.json`. Untrusted input, including workflow inputs and registry responses, must be validated before it reaches a shell or an API call, and failures must throw.
- The tag script and the release workflow both require the tag to equal the `main` tip. Do not accept an ancestor check; the PR 51 acceptance ledger forbids it.
