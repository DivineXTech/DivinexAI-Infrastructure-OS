/** Minimal RFC 4180 CSV serialization — no external dependency needed for this scale. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escapeCell = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escapeCell).join(",");
  const body = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(","));
  return [header, ...body].join("\r\n") + "\r\n";
}
