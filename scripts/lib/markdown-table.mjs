/**
 * Escape one value for a GitHub-flavoured Markdown table cell.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cell(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

/**
 * Render a left-aligned Markdown table with escaped cells.
 *
 * @param {readonly unknown[]} headers
 * @param {readonly (readonly unknown[])[]} rows
 * @returns {string}
 */
export function table(headers, rows) {
  const line = /** @param {readonly unknown[]} values */ (values) =>
    `| ${values.map(cell).join(" | ")} |`;
  return [line(headers), `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(line)].join(
    "\n",
  );
}
