export class ServiceNowConfigError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ServiceNowConfigError";
    this.path = path;
  }
}

export class ServiceNowSettingsError extends ServiceNowConfigError {
  constructor(path: string, message: string) {
    super(`settings.servicenow${path}`, message);
    this.name = "ServiceNowSettingsError";
  }
}

/**
 * Rejection message for Fluent authoring combined with instance execution
 * surfaces. Validation raises it; context resolution repeats it as a defence,
 * so both sites must report the same text.
 */
export const FLUENT_SURFACES_MESSAGE = "Fluent authoring cannot list instance execution surfaces";
