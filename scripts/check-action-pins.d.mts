export function extractUsesReferences(text: string): string[];
export function scanWorkflowText(
  file: string,
  text: string,
  seen?: Map<string, { file: string; ref: string }>,
): string[];
export function checkActionPins(): { workflows: number; actions: number };
export function main(): { workflows: number; actions: number };
