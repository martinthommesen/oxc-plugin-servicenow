export function parseVersion(value: string): [number, number, number];
export function satisfiesRange(version: string, range: string): boolean;
export function rangeFloor(range: string): string;
export function rangeTopMajor(range: string): number;
