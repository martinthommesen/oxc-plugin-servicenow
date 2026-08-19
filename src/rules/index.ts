import type { Rule } from "@oxlint/plugins";
import { fluentDirectives } from "./fluent-directives.js";
import { fluentNamingConvention } from "./fluent-naming-convention.js";
import { fluentProperImports } from "./fluent-proper-imports.js";
import { noAsyncAwait } from "./no-async-await.js";
import { noAsyncIterators } from "./no-async-iterators.js";
import { noAtMethod } from "./no-at-method.js";
import { noBigint } from "./no-bigint.js";
import { noBrCurrentUpdate } from "./no-br-current-update.js";
import { noClientGliderecord } from "./no-client-gliderecord.js";
import { noComplexFluentLogic } from "./no-complex-fluent-logic.js";
import { noDeleteMultipleWithWindowing } from "./no-delete-multiple-with-windowing.js";
import { noDisplayValueDateComparison } from "./no-display-value-date-comparison.js";
import { noDuplicateFluentId } from "./no-duplicate-fluent-id.js";
import { noGlideajaxGetanswer } from "./no-glideajax-getanswer.js";
import { noGlideelementInCollection } from "./no-glideelement-in-collection.js";
import { noGliderecordQueryInLoop } from "./no-gliderecord-query-in-loop.js";
import { noGliderecordQueryModifierAfterQuery } from "./no-gliderecord-query-modifier-after-query.js";
import { noSystemQueryBypass } from "./no-system-query-bypass.js";
import { noUnfilteredGliderecordBulkOperation } from "./no-unfiltered-gliderecord-bulk-operation.js";
import { noGsNow } from "./no-gs-now.js";
import { noNowIdAsReference } from "./no-now-id-as-reference.js";
import { noHardcodedSysid } from "./no-hardcoded-sysid.js";
import { noHardcodedTableNames } from "./no-hardcoded-table-names.js";
import { noPackagesCalls } from "./no-packages-calls.js";
import { noPromise } from "./no-promise.js";
import { noProxy } from "./no-proxy.js";
import { noSyncGlideajax } from "./no-sync-glideajax.js";
import { noTypedArrays } from "./no-typed-arrays.js";
import { noUnsupportedSyntax } from "./no-unsupported-syntax.js";
import { noWeakCollections } from "./no-weak-collections.js";
import { noWeakReferences } from "./no-weak-references.js";
import { preferGlideaggregate } from "./prefer-glideaggregate.js";
import { preferNowInclude } from "./prefer-now-include.js";
import { requireBusinessRuleWrapper } from "./require-business-rule-wrapper.js";
import { requireCallbackForGetreference } from "./require-callback-for-getreference.js";
import { requireFluentId } from "./require-fluent-id.js";
import { requireGlideajaxSysparmName } from "./require-glideajax-sysparm-name.js";
import { requireQueryBeforeNext } from "./require-query-before-next.js";
import { validateGlideaggregateCalls } from "./validate-glideaggregate-calls.js";
import { validateGliderecordCalls } from "./validate-gliderecord-calls.js";

export const rules = {
  "no-hardcoded-sysid": noHardcodedSysid,
  "no-promise": noPromise,
  "no-async-await": noAsyncAwait,
  "no-bigint": noBigint,
  "prefer-glideaggregate": preferGlideaggregate,
  "no-client-gliderecord": noClientGliderecord,
  "no-gs-now": noGsNow,
  "require-query-before-next": requireQueryBeforeNext,
  "validate-gliderecord-calls": validateGliderecordCalls,
  "no-br-current-update": noBrCurrentUpdate,
  "no-hardcoded-table-names": noHardcodedTableNames,
  "fluent-proper-imports": fluentProperImports,
  "fluent-directives": fluentDirectives,
  "prefer-now-include": preferNowInclude,
  "require-fluent-id": requireFluentId,
  "fluent-naming-convention": fluentNamingConvention,
  "no-complex-fluent-logic": noComplexFluentLogic,
  "no-at-method": noAtMethod,
  "no-packages-calls": noPackagesCalls,
  "no-weak-references": noWeakReferences,
  "no-weak-collections": noWeakCollections,
  "no-async-iterators": noAsyncIterators,
  "no-typed-arrays": noTypedArrays,
  "no-proxy": noProxy,
  "no-unsupported-syntax": noUnsupportedSyntax,
  "no-sync-glideajax": noSyncGlideajax,
  "no-delete-multiple-with-windowing": noDeleteMultipleWithWindowing,
  "require-callback-for-getreference": requireCallbackForGetreference,
  "require-glideajax-sysparm-name": requireGlideajaxSysparmName,
  "validate-glideaggregate-calls": validateGlideaggregateCalls,
  "no-now-id-as-reference": noNowIdAsReference,
  "no-glideajax-getanswer": noGlideajaxGetanswer,
  "no-duplicate-fluent-id": noDuplicateFluentId,
  "no-glideelement-in-collection": noGlideelementInCollection,
  "no-gliderecord-query-modifier-after-query": noGliderecordQueryModifierAfterQuery,
  "require-business-rule-wrapper": requireBusinessRuleWrapper,
  "no-display-value-date-comparison": noDisplayValueDateComparison,
  "no-unfiltered-gliderecord-bulk-operation": noUnfilteredGliderecordBulkOperation,
  "no-gliderecord-query-in-loop": noGliderecordQueryInLoop,
  "no-system-query-bypass": noSystemQueryBypass,
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof rules;
