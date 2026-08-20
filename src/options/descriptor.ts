import { ServiceNowConfigError } from "../settings/errors.js";

export type OptionFieldKind = "boolean" | "integer" | "enum" | "string" | "stringArray";

interface OptionFieldBase {
  description: string;
}

export interface BooleanOptionField extends OptionFieldBase {
  kind: "boolean";
  default: boolean;
}

export interface IntegerOptionField extends OptionFieldBase {
  kind: "integer";
  default: number;
  minimum?: number;
  maximum?: number;
}

export interface EnumOptionField<T extends string = string> extends OptionFieldBase {
  kind: "enum";
  values: readonly T[];
  default: T;
}

export interface StringOptionField extends OptionFieldBase {
  kind: "string";
  default: string;
  minLength?: number;
}

export interface StringArrayOptionField extends OptionFieldBase {
  kind: "stringArray";
  default: readonly string[];
}

export type OptionField =
  | BooleanOptionField
  | IntegerOptionField
  | EnumOptionField
  | StringOptionField
  | StringArrayOptionField;

export interface RuleOptionsDescriptor<T extends object> {
  ruleName: string;
  fields: { [K in keyof T]-?: OptionField };
}

export interface RuleOptionDoc {
  name: string;
  type: string;
  default: string;
  description: string;
}

export function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function descriptorDefaults<T extends object>(
  descriptor: RuleOptionsDescriptor<T>,
): T {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(descriptor.fields)) {
    const typed = field as OptionField;
    out[key] = typed.kind === "stringArray" ? [...typed.default] : typed.default;
  }
  return out as T;
}

function parseField(field: OptionField, path: string, value: unknown): unknown {
  switch (field.kind) {
    case "boolean":
      if (typeof value !== "boolean") {
        throw new ServiceNowConfigError(path, `expected a boolean, got ${typeName(value)}`);
      }
      return value;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new ServiceNowConfigError(path, `expected an integer, got ${JSON.stringify(value)}`);
      }
      if (field.minimum !== undefined && value < field.minimum) {
        throw new ServiceNowConfigError(path, `expected an integer >= ${field.minimum}, got ${value}`);
      }
      if (field.maximum !== undefined && value > field.maximum) {
        throw new ServiceNowConfigError(path, `expected an integer <= ${field.maximum}, got ${value}`);
      }
      return value;
    case "enum":
      if (typeof value !== "string" || !field.values.includes(value)) {
        throw new ServiceNowConfigError(
          path,
          `expected one of ${field.values.join(", ")}, got ${JSON.stringify(value)}`,
        );
      }
      return value;
    case "string":
      if (typeof value !== "string") {
        throw new ServiceNowConfigError(path, `expected a string, got ${typeName(value)}`);
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        throw new ServiceNowConfigError(
          path,
          `expected a string of at least ${field.minLength} characters`,
        );
      }
      return value;
    case "stringArray":
      if (!Array.isArray(value)) {
        throw new ServiceNowConfigError(path, `expected an array of strings, got ${typeName(value)}`);
      }
      return value.map((item, index) => {
        if (typeof item !== "string") {
          throw new ServiceNowConfigError(
            `${path}[${index}]`,
            `expected a string, got ${typeName(item)}`,
          );
        }
        return item;
      });
    default: {
      const unexpected: never = field;
      throw new ServiceNowConfigError(path, `unhandled option field ${JSON.stringify(unexpected)}`);
    }
  }
}

function jsonSchemaProperty(field: OptionField): Record<string, unknown> {
  switch (field.kind) {
    case "boolean":
      return { type: "boolean" };
    case "integer": {
      const schema: Record<string, unknown> = { type: "integer" };
      if (field.minimum !== undefined) schema.minimum = field.minimum;
      if (field.maximum !== undefined) schema.maximum = field.maximum;
      return schema;
    }
    case "enum":
      return { enum: [...field.values] };
    case "string": {
      const schema: Record<string, unknown> = { type: "string" };
      if (field.minLength !== undefined) schema.minLength = field.minLength;
      return schema;
    }
    case "stringArray":
      return { type: "array", items: { type: "string" } };
    default: {
      const unexpected: never = field;
      throw new Error(`unhandled option field ${JSON.stringify(unexpected)}`);
    }
  }
}

function optionTypeLabel(field: OptionField): string {
  switch (field.kind) {
    case "boolean":
      return "boolean";
    case "integer":
      return "integer";
    case "enum":
      return field.values.map((value) => JSON.stringify(value)).join(" | ");
    case "string":
      return "string";
    case "stringArray":
      return "string[]";
    default: {
      const unexpected: never = field;
      throw new Error(`unhandled option field ${JSON.stringify(unexpected)}`);
    }
  }
}

function optionDefaultLabel(field: OptionField): string {
  switch (field.kind) {
    case "boolean":
    case "integer":
    case "enum":
    case "string":
      return JSON.stringify(field.default);
    case "stringArray":
      return JSON.stringify([...field.default]);
    default: {
      const unexpected: never = field;
      throw new Error(`unhandled option field ${JSON.stringify(unexpected)}`);
    }
  }
}

export function schemaFromDescriptor(
  descriptor: RuleOptionsDescriptor<object>,
): Record<string, unknown>[] {
  const properties: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(descriptor.fields)) {
    properties[key] = jsonSchemaProperty(field as OptionField);
  }
  return [
    {
      type: "object",
      additionalProperties: false,
      properties,
    },
  ];
}

export function optionDocsFromDescriptor(
  descriptor: RuleOptionsDescriptor<object>,
): RuleOptionDoc[] {
  return Object.entries(descriptor.fields).map(([name, field]) => {
    const typed = field as OptionField;
    return {
      name,
      type: optionTypeLabel(typed),
      default: optionDefaultLabel(typed),
      description: typed.description,
    };
  });
}

/**
 * Parse rule options from the host `context.options` array.
 * Missing values use descriptor defaults. Invalid values throw
 * {@link ServiceNowConfigError} with a complete option path.
 */
export function parseRuleOptions<T extends object>(
  descriptor: RuleOptionsDescriptor<T>,
  rawOptions: readonly unknown[],
  index = 0,
): T {
  if (rawOptions.length > index + 1) {
    throw new ServiceNowConfigError(`options[${index + 1}]`, "unexpected extra option value");
  }
  const raw = rawOptions[index];
  if (raw === undefined) {
    return descriptorDefaults(descriptor);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ServiceNowConfigError(`options[${index}]`, `expected an object, got ${typeName(raw)}`);
  }
  const rec = raw as Record<string, unknown>;
  const allowed = new Set(Object.keys(descriptor.fields));
  for (const key of Object.keys(rec)) {
    if (!allowed.has(key)) {
      throw new ServiceNowConfigError(`options[${index}].${key}`, "unknown option");
    }
  }
  const result = descriptorDefaults(descriptor);
  for (const [key, field] of Object.entries(descriptor.fields)) {
    if (!Object.prototype.hasOwnProperty.call(rec, key)) continue;
    (result as Record<string, unknown>)[key] = parseField(
      field as OptionField,
      `options[${index}].${key}`,
      rec[key],
    );
  }
  return result;
}
