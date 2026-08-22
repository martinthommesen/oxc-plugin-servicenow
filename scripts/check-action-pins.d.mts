export interface WorkflowSource {
  file: string;
  text: string;
}

export interface ActionPin {
  action: string;
  commit: string;
}

export interface ActionPinCheckResult {
  workflows: number;
  actions: number;
}

export function checkActionPinSources(
  sources: readonly WorkflowSource[],
  pinEntries: readonly ActionPin[],
): ActionPinCheckResult;
export function parseActionPinCatalog(source: string): ActionPin[];
export function checkActionPins(): ActionPinCheckResult;
export function main(): ActionPinCheckResult;
