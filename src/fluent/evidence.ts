const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export function compareFluentVersions(left: string, right: string): number {
  const leftParts = STABLE_VERSION.exec(left);
  const rightParts = STABLE_VERSION.exec(right);
  if (!leftParts || !rightParts) throw new Error("Fluent evidence versions must use stable semver");
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftParts[index]) - Number(rightParts[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function isAllowedFluentEvidenceLocation(value: string): boolean {
  if (/^(?:tests|src|docs)\//.test(value)) {
    return !value.includes("\\") && !value.split("/").includes("..");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    return false;
  if (url.hostname === "www.servicenow.com") return url.pathname.startsWith("/docs/");
  return (
    url.hostname === "registry.npmjs.org" &&
    /^\/@servicenow%2fsdk-core\/-\/sdk-core-\d+\.\d+\.\d+\.tgz$/i.test(url.pathname)
  );
}
