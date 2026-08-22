declare const Now: {
  readonly ID: Readonly<Record<string, string>>;
  include(path: string): string;
};

declare module "@servicenow/sdk/core" {
  export function BusinessRule(input: Readonly<Record<string, unknown>>): unknown;
  export function StringColumn(input: Readonly<Record<string, unknown>>): unknown;
  export function Table(input: Readonly<Record<string, unknown>>): unknown;
}

declare module "@servicenow/sdk/app" {
  export function Flow(input: Readonly<Record<string, unknown>>): unknown;
}
