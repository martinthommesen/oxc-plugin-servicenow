import type { Rule } from "@oxlint/plugins";
import type { RuleProfile } from "./catalog/types.js";
import { noHardcodedSysidEntry } from "./catalog/no-hardcoded-sysid.js";
import { noPromiseEntry } from "./catalog/no-promise.js";
import { noAsyncAwaitEntry } from "./catalog/no-async-await.js";
import { noBigintEntry } from "./catalog/no-bigint.js";
import { noIncorrectArrayFromThisargEntry } from "./catalog/no-incorrect-array-from-thisarg.js";
import { noUnhoistedBlockFunctionUseEntry } from "./catalog/no-unhoisted-block-function-use.js";
import { noObjectMethodConstructorEntry } from "./catalog/no-object-method-constructor.js";
import { noIncorrectBigintAsuintnEntry } from "./catalog/no-incorrect-bigint-asuintn.js";
import { preferGlideaggregateEntry } from "./catalog/prefer-glideaggregate.js";
import { noClientGliderecordEntry } from "./catalog/no-client-gliderecord.js";
import { noGsNowEntry } from "./catalog/no-gs-now.js";
import { requireQueryBeforeNextEntry } from "./catalog/require-query-before-next.js";
import { noBrCurrentUpdateEntry } from "./catalog/no-br-current-update.js";
import { noHardcodedTableNamesEntry } from "./catalog/no-hardcoded-table-names.js";
import { fluentProperImportsEntry } from "./catalog/fluent-proper-imports.js";
import { fluentDirectivesEntry } from "./catalog/fluent-directives.js";
import { preferNowIncludeEntry } from "./catalog/prefer-now-include.js";
import { requireFluentIdEntry } from "./catalog/require-fluent-id.js";
import { fluentNamingConventionEntry } from "./catalog/fluent-naming-convention.js";
import { noComplexFluentLogicEntry } from "./catalog/no-complex-fluent-logic.js";
import { noAtMethodEntry } from "./catalog/no-at-method.js";
import { noPackagesCallsEntry } from "./catalog/no-packages-calls.js";
import { noWeakReferencesEntry } from "./catalog/no-weak-references.js";
import { noMapSetEntry } from "./catalog/no-map-set.js";
import { noWeakCollectionsEntry } from "./catalog/no-weak-collections.js";
import { noObjectHasownEntry } from "./catalog/no-object-hasown.js";
import { noUnsupportedDateFractionEntry } from "./catalog/no-unsupported-date-fraction.js";
import { noUnsupportedSetMethodsEntry } from "./catalog/no-unsupported-set-methods.js";
import { noUnsupportedStaticMethodsEntry } from "./catalog/no-unsupported-static-methods.js";
import { noTypedArraysEntry } from "./catalog/no-typed-arrays.js";
import { noProxyEntry } from "./catalog/no-proxy.js";
import { noUnsupportedSyntaxEntry } from "./catalog/no-unsupported-syntax.js";
import { noDeleteMultipleWithWindowingEntry } from "./catalog/no-delete-multiple-with-windowing.js";
import { requireCallbackForGetreferenceEntry } from "./catalog/require-callback-for-getreference.js";
import { requireGlideajaxSysparmNameEntry } from "./catalog/require-glideajax-sysparm-name.js";
import { validateGlideaggregateCallsEntry } from "./catalog/validate-glideaggregate-calls.js";
import { noNowIdAsReferenceEntry } from "./catalog/no-now-id-as-reference.js";
import { noGlideajaxGetanswerEntry } from "./catalog/no-glideajax-getanswer.js";
import { noDuplicateFluentIdEntry } from "./catalog/no-duplicate-fluent-id.js";
import { noGlideelementInCollectionEntry } from "./catalog/no-glideelement-in-collection.js";
import { noGliderecordQueryModifierAfterQueryEntry } from "./catalog/no-gliderecord-query-modifier-after-query.js";
import { requireBusinessRuleWrapperEntry } from "./catalog/require-business-rule-wrapper.js";
import { noDisplayValueDateComparisonEntry } from "./catalog/no-display-value-date-comparison.js";
import { noUnfilteredGliderecordBulkOperationEntry } from "./catalog/no-unfiltered-gliderecord-bulk-operation.js";
import { noGliderecordQueryInAclEntry } from "./catalog/no-gliderecord-query-in-acl.js";
import { noGliderecordQueryInLoopEntry } from "./catalog/no-gliderecord-query-in-loop.js";
import { preferSetnocountWithChoosewindowEntry } from "./catalog/prefer-setnocount-with-choosewindow.js";
import { noSystemQueryBypassEntry } from "./catalog/no-system-query-bypass.js";
import { noSyncGlideajaxEntry } from "./catalog/no-sync-glideajax.js";
import { noAsyncIteratorsEntry } from "./catalog/no-async-iterators.js";

export type { RuleProfile };

export const ruleCatalog = [
  noHardcodedSysidEntry,
  noPromiseEntry,
  noAsyncAwaitEntry,
  noBigintEntry,
  noIncorrectArrayFromThisargEntry,
  noUnhoistedBlockFunctionUseEntry,
  noObjectMethodConstructorEntry,
  noIncorrectBigintAsuintnEntry,
  preferGlideaggregateEntry,
  noClientGliderecordEntry,
  noGsNowEntry,
  requireQueryBeforeNextEntry,
  noBrCurrentUpdateEntry,
  noHardcodedTableNamesEntry,
  fluentProperImportsEntry,
  fluentDirectivesEntry,
  preferNowIncludeEntry,
  requireFluentIdEntry,
  fluentNamingConventionEntry,
  noComplexFluentLogicEntry,
  noAtMethodEntry,
  noPackagesCallsEntry,
  noWeakReferencesEntry,
  noMapSetEntry,
  noWeakCollectionsEntry,
  noObjectHasownEntry,
  noUnsupportedDateFractionEntry,
  noUnsupportedSetMethodsEntry,
  noUnsupportedStaticMethodsEntry,
  noTypedArraysEntry,
  noProxyEntry,
  noUnsupportedSyntaxEntry,
  noDeleteMultipleWithWindowingEntry,
  requireCallbackForGetreferenceEntry,
  requireGlideajaxSysparmNameEntry,
  validateGlideaggregateCallsEntry,
  noNowIdAsReferenceEntry,
  noGlideajaxGetanswerEntry,
  noDuplicateFluentIdEntry,
  noGlideelementInCollectionEntry,
  noGliderecordQueryModifierAfterQueryEntry,
  requireBusinessRuleWrapperEntry,
  noDisplayValueDateComparisonEntry,
  noUnfilteredGliderecordBulkOperationEntry,
  noGliderecordQueryInAclEntry,
  noGliderecordQueryInLoopEntry,
  preferSetnocountWithChoosewindowEntry,
  noSystemQueryBypassEntry,
  noSyncGlideajaxEntry,
  noAsyncIteratorsEntry,
];

const catalogNames = new Set<string>();
const catalogRuleIds = new Set<string>();
const catalogImplementations = new Set<Rule>();
for (const item of ruleCatalog) {
  if (catalogNames.has(item.name)) throw new Error(`Duplicate catalog rule name: ${item.name}`);
  if (catalogRuleIds.has(item.ruleId)) throw new Error(`Duplicate catalog rule ID: ${item.ruleId}`);
  if (catalogImplementations.has(item.implementation)) {
    throw new Error(`Duplicate catalog implementation: ${item.name}`);
  }
  if (item.optionDescriptor && item.optionDescriptor.ruleName !== item.name) {
    throw new Error(
      `Catalog option descriptor ${item.optionDescriptor.ruleName} does not match ${item.name}`,
    );
  }
  const profiles = new Set<RuleProfile>();
  for (const placement of item.placements) {
    if (profiles.has(placement.profile)) {
      throw new Error(`Duplicate ${placement.profile} placement for ${item.name}`);
    }
    profiles.add(placement.profile);
  }
  catalogNames.add(item.name);
  catalogRuleIds.add(item.ruleId);
  catalogImplementations.add(item.implementation);
}

export type RuleName = (typeof ruleCatalog)[number]["name"];

export const ruleImplementations = ruleCatalog.map(({ name, implementation }) => ({
  name,
  implementation,
}));

export const rulePlacements = ruleCatalog.map(({ ruleId, placements }) => ({ ruleId, placements }));
