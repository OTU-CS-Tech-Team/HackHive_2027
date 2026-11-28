// Rebuilds src/data/mlh-schools.json from MLH's verified school list.
// MLH requires the registration form's school options to come from this list.
//
//   npm run schools:build                 # download the latest list
//   npm run schools:build -- path/to.csv  # or convert a local copy
//
// The output is a JSON array of unique school names, in MLH's order. It is
// read on the server only (the /api/schools search); it never ships to browsers.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SOURCE_URL = 'https://raw.githubusercontent.com/MLH/mlh-policies/main/schools.csv';
const OUTPUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'mlh-schools.json');

/** Splits CSV text into rows of fields, honouring quotes and "" escapes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Unique, trimmed school names. The first row is MLH's note about the list, not a school. */
export function schoolNames(csv) {
  const seen = new Set();
  const names = [];
  for (const [first = ''] of parseCsv(csv.replace(/^﻿/, '')).slice(1)) {
    const name = first.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

async function main() {
  const source = process.argv[2];
  let csv;
  if (source) {
    csv = await readFile(source, 'utf8');
  } else {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`Could not download ${SOURCE_URL}: ${res.status} ${res.statusText}`);
    csv = await res.text();
  }
  const names = schoolNames(csv);
  if (names.length < 1000) throw new Error(`Only ${names.length} schools found; refusing to overwrite the list.`);
  await writeFile(OUTPUT, `[\n${names.map((name) => JSON.stringify(name)).join(',\n')}\n]\n`);
  console.log(`Wrote ${names.length} schools to ${path.relative(process.cwd(), OUTPUT)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
