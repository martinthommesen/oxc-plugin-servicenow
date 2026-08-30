# Cloud Agent base image for oxc-plugin-servicenow.
#
# CI pins Node 24.16.0 (see .github/workflows/ci.yml). The test suite's JSON
# reporter depends on node:test event fields (details.type === "test") that are
# absent on Node 22, so the base image pins the same Node version as CI.
FROM node:24.16.0-bookworm-slim

# git and curl are required for repository checkout and tooling; ca-certificates
# lets npm reach the registry over HTTPS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

USER node
