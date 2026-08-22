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
