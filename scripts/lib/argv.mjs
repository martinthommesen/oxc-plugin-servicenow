/**
 * Read the value that follows `name` in `argv`.
 *
 * An absent flag yields `undefined`. A flag present without a usable value is
 * a caller error: `onError` lets a script raise its own tagged failure with
 * the same message, and without it the value is a plain `Error`.
 *
 * @param {readonly string[]} argv
 * @param {string} name
 * @param {(message: string) => never} [onError]
 * @returns {string | undefined}
 */
export function argValue(argv, name, onError) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    const message = `${name} requires a value`;
    if (onError) onError(message);
    throw new Error(message);
  }
  return value;
}
