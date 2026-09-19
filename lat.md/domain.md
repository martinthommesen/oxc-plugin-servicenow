ServiceNow JavaScript runs in several environments with different capabilities. This file names those axes; [[context]] covers how one file is classified onto them.

## Authoring: classic or Fluent

Classic scripts are JavaScript records executed by the instance. Fluent files are TypeScript build metadata for the ServiceNow SDK, identified by the `.now.ts` suffix.

`ScriptAuthoring` is `"classic" | "fluent"`, declared in [[src/types.ts#ScriptAuthoring]]. The two are mutually exclusive: a Fluent file is never instance-executed, so engine rules and instance-surface rules do not apply to it. `isFluentContext` in [[src/context/resolve.ts#isFluentContext]] is the check every rule uses.

Fluent files also carry no execution surface. `resolveSurfaces` returns an empty surface set for them, and an explicit `surfaces` setting alongside explicit Fluent authoring is a configuration error — see [[context#Surfaces]].

## Script surfaces

One file can be executed in more than one place. `ScriptSurface` in [[src/types.ts#ScriptSurface]] has eight members:

| Surface | Where the script runs |
| --- | --- |
| `client` | Browser, against the form or the catalog client |
| `server` | Instance, as a general server-side script |
| `acl` | Instance, as an Access Control script |
| `business-rule` | Instance, as a Business Rule |
| `script-include` | Instance, as a reusable Script Include class |
| `ui-action` | A record type, not an execution side — see below |
| `scheduled-script` | Instance, as a Scheduled Job |
| `fix-script` | Instance, as a Fix Script |

The set is a set, not a single value, because a UI Action can run on the client, the server, or both. `ui-action` is deliberately different in kind from the rest: it names the record type the code belongs to rather than where it executes, so it composes with `client` and `server` instead of replacing them. A file with only `ui-action` evidence is not treated as server-capable.

`isServerInstanceContext` in [[src/context/resolve.ts#isServerInstanceContext]] expands a server check across the six server-only surfaces and requires explicit `server` evidence on a UI Action. `isMixedUiActionContext` identifies the client-and-server case. `docs/rules/*.md` records which surfaces each rule applies to.

## JavaScript modes

The instance executes scripts under one of three modes. `JavaScriptMode` in [[src/types.ts#JavaScriptMode]] adds a fourth state, `"unknown"`.

| Mode | Meaning |
| --- | --- |
| `compatibility` | Legacy Rhino behavior |
| `es5` | ES5 Standards mode |
| `es2021` | ES2021 mode, the modern default |
| `unknown` | No evidence; the plugin must not assume ES5 |

`unknown` is not a mode the instance has. It is the honest answer when nothing proves the mode, and it gates rules rather than being interpreted. `appliesInJavaScriptModes` in [[src/context/resolve.ts#appliesInJavaScriptModes]] refuses to run a mode-specific rule when the mode is unknown. See [[engine]] for what is known per mode.

## Releases

`ServiceNowRelease` is `"zurich" | "australia"`, declared in [[src/settings/releases.ts#SUPPORTED_SERVICENOW_RELEASES]]. Each release is a separate column of versioned knowledge: which engine features exist, which GlideRecord methods are documented, and which rules have been reviewed against it.

An omitted release is a third state, not a default to the newest one. Every lookup over releases requires all admissible releases to agree before it returns an answer; otherwise the fact is unknown. `featureSupport` in [[src/engine/features.ts#featureSupport]] and `resolveGlideCapabilities` in [[src/glide/manifest.ts#resolveGlideCapabilities]] both apply this. Setting the release restores the release-specific answer.

## Two independent version axes

The instance release and the Fluent SDK version describe different things and must never be substituted for each other.

- `settings.servicenow.release` selects instance behavior: which engine features exist, which GlideRecord methods are documented.
- `settings.servicenow.fluentSdkVersion` selects the `@servicenow/sdk/core` API surface, defaulting to `DEFAULT_FLUENT_SDK_VERSION` in [[src/fluent/sdk-versions.ts#DEFAULT_FLUENT_SDK_VERSION]].

A Fluent file is built by the SDK and deployed to an instance; both axes apply to it and neither derives from the other. `docs/rules/*.md` states this per rule — Fluent-SDK-versioned rules carry a `fluentSdkRange` and no instance release claim.

## Application scope

`ApplicationScope` is `"global" | "scoped" | "unknown"`. Scope selects which GlideRecord methods are documented as available rather than changing what the script means. See [[glide]].

## Related

Other files that describe the same axes from different angles.

- [[context]] — how each axis is resolved for a file, and with what confidence.
- [[engine]], [[glide]], [[fluent]] — the versioned knowledge per axis.
