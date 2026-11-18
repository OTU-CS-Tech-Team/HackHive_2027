function cell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (typeof value === "object") text = JSON.stringify(value); // arrays, jsonb
  else text = String(value);

  // Neutralize spreadsheet formulas in text. Numbers are left alone so -5 stays -5.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  // Union of keys in first-seen order, so the columns follow your table's order.
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return [
    headers.map(cell).join(","),
    ...rows.map(row => headers.map(h => cell(row[h])).join(",")),
  ].join("\r\n");
}