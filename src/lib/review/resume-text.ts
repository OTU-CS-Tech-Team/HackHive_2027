// Turns a resume PDF into what a blind reviewer reads: just the Experience and
// Projects sections, pulled out of the text with pdfjs. Everything else (the
// header with name and contact details, Education, Skills and so on) is left
// out entirely, so nothing needs to be blanked out. Schools mentioned inside
// experience (e.g. research at a university) are fine to show.
// If neither section can be found (a scanned image, a locked or broken PDF, an
// unusual layout) it fails, and the card shows the original behind a warning.

/** Each section is a list of entries (one job or project), each a list of lines; the first line is its title. */
export type ResumeSections = { experience: string[][]; projects: string[][] };
export type CleanResume = ({ ok: true } & ResumeSections) | { ok: false; reason: string };

/** Fewer than this many letters/digits across both sections = couldn't be read. */
export const MIN_SECTION_CHARS = 40;

type Section = keyof ResumeSections | "other";

const SECTIONS: Record<string, Section> = {
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "relevant experience": "experience",
  "technical experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "work history": "experience",
  internships: "experience",
  "research experience": "experience",
  research: "experience",
  projects: "projects",
  "personal projects": "projects",
  "technical projects": "projects",
  "selected projects": "projects",
  "side projects": "projects",
  "academic projects": "projects",
  "relevant projects": "projects",
};

// Any other heading ends the current section.
const OTHER_HEADINGS = [
  "education", "academic background", "academics", "academic history", "education and training", "education & training",
  "skills", "technical skills", "skills and interests", "skills & interests", "core competencies", "technologies", "tools",
  "languages", "awards", "honors", "honours", "awards and honors", "awards & honors", "honors & awards", "honours & awards",
  "achievements", "certifications", "certificates", "licenses and certifications", "volunteer", "volunteering",
  "volunteer experience", "leadership", "leadership experience", "activities", "extracurriculars",
  "extracurricular activities", "involvement", "publications", "interests", "hobbies", "summary", "profile", "about",
  "about me", "objective", "hackathons", "contact", "references",
];

const normalizeHeading = (line: string) =>
  line
    .toLowerCase()
    .replace(/[:|•·_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Which section this line starts, or null if it isn't a heading. Headings are short lines like "PROJECTS" or "Work Experience:". */
export function headingOf(line: string): Section | null {
  if (line.trim().length > 40) return null;
  const heading = normalizeHeading(line);
  return SECTIONS[heading] ?? (OTHER_HEADINGS.includes(heading) ? "other" : null);
}

// Links and emails can carry a name (github.com/janedoe), so they're dropped quietly.
const LINK = /\b(?:https?:\/\/|www\.)\S+|\S+@\S+\.[a-z]{2,}|\b(?:github|gitlab|linkedin|devpost)\.com\/\S*/gi;

const tidy = (line: string) =>
  line
    .replace(LINK, "")
    .replace(/[ \t]+/g, " ")
    .replace(/^[\s|·•,-]+$/, "")
    .trim();

const meaningfulChars = (text: string) => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

/** Keeps only the Experience and Projects sections (heading to the next heading). */
export function extractSections(text: string): ResumeSections {
  const out: Record<keyof ResumeSections, string[]> = { experience: [], projects: [] }; // raw lines
  let current: Section | null = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = headingOf(line);
    if (heading) {
      current = heading;
      continue;
    }
    if (current === "experience" || current === "projects") {
      const cleaned = tidy(line);
      if (cleaned) out[current].push(cleaned);
    }
  }
  return { experience: splitEntries(out.experience), projects: splitEntries(out.projects) };
}

const BULLET = /^[•●▪◦‣∙·*–-]\s*/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
// "May 2025", "05/2025", "2024 – Present", "Summer 2023".
const DATE = new RegExp(`\\b(?:${MONTH}\\s*'?\\d{2,4}|\\d{1,2}/\\d{4}|(?:19|20)\\d{2}\\s*[–—-]|present|current|(?:spring|summer|fall|autumn|winter)\\s+(?:19|20)\\d{2})\\b`, "i");

const isBullet = (line: string) => BULLET.test(line);
const hasDate = (line: string | undefined) => !!line && DATE.test(line);
const startsUpper = (line: string) => /^[\p{Lu}\p{N}]/u.test(line);

/** A short line that's mostly a date ("May 2025 - Aug 2025"), shown under an entry's title rather than as a detail. */
export const isDateLine = (line: string) => line.length <= 40 && hasDate(line);

/**
 * Splits a section's lines into separate jobs/projects. A resume entry is
 * usually a title line (often with or next to a date) followed by bullets, so
 * a new entry starts at a non-bullet line after bullets, or at a second date
 * line when the section has no bullets. Bullet markers are dropped.
 */
export function splitEntries(lines: string[]): string[][] {
  const entries: string[][] = [];
  let current: string[] = [];
  let currentHasBullet = false;
  let currentHasDate = false;

  lines.forEach((line, i) => {
    const prev = lines[i - 1] ?? "";
    let carry: string | null = null;
    let fresh = false;

    if (current.length && !isBullet(line)) {
      if (currentHasBullet) {
        // A wrapped bullet continues on a line without a marker, so also want an
        // upper-case start and a date nearby or the bullet above having ended.
        fresh = startsUpper(line) && (hasDate(line) || hasDate(lines[i + 1]) || hasDate(lines[i + 2]) || /[.!?)]$/.test(prev));
      } else if (hasDate(line) && currentHasDate) {
        fresh = true;
        // The title line just above the date belongs to the new entry.
        if (current.length > 1 && !hasDate(prev)) carry = current.pop() ?? null;
      }
    }

    if (fresh) {
      entries.push(current);
      current = carry ? [carry] : [];
      currentHasBullet = false;
      currentHasDate = !!carry && hasDate(carry);
    }
    const text = line.replace(BULLET, "").trim();
    if (text) current.push(text);
    currentHasBullet ||= isBullet(line);
    currentHasDate ||= hasDate(line);
  });
  if (current.length) entries.push(current);
  return entries;
}

/** Bump when the cleaning changes, so cached results are rebuilt. */
export const RESUME_CLEANER_VERSION = 2;

/** What we know about the applicant, used only to drop lines that would identify them. */
export type ResumeIdentity = { firstNames?: (string | null | undefined)[]; lastName?: string | null; email?: string | null };

// 905-555-0100, (905) 555-0100, +1 905 555 0100, 9055550100, +44 20 7946 0958.
const PHONE = /(?<![\p{L}\p{N}])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?![\p{L}\p{N}])|\+\d{1,3}(?:[\s.-]?\d){7,12}(?!\d)/gu;

const fold = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameParts = (names: (string | null | undefined)[]) =>
  names.flatMap((name) => fold(name ?? "").split(/[^\p{L}\p{N}']+/u)).filter((part) => part.length >= 2);
const wordsPattern = (words: string[]) =>
  words.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegex).join("|")})(?![\\p{L}\\p{N}])`, "u") : null;

/**
 * A test for lines that name the applicant: their email handle, their first
 * and last name together, or a short line (a header like "Jane Doe") with
 * either. A first name alone in a sentence ("May 2025") is left alone.
 */
function identityTest(identity: ResumeIdentity | undefined): ((line: string) => boolean) | null {
  const first = wordsPattern(nameParts(identity?.firstNames ?? []));
  const last = wordsPattern(nameParts([identity?.lastName]));
  const handle = fold(identity?.email ?? "").split("@")[0];
  const email = handle.length >= 3 ? wordsPattern([handle]) : null;
  if (!first && !last && !email) return null;
  return (raw) => {
    const line = fold(raw);
    if (email?.test(line)) return true;
    const hasFirst = !!first?.test(line);
    const hasLast = !!last?.test(line);
    if (hasFirst && hasLast) return true;
    // Short lines only, and never a date (a first name like "May").
    return (hasFirst || hasLast) && line.trim().split(/\s+/).length <= 4 && !hasDate(raw);
  };
}

/**
 * Lines that repeat on more than one page are page headers or footers
 * ("Jane Doe · 905-555-0100 · Page 2"), so they're dropped wherever they appear.
 */
function repeatedLines(pages: string[]): Set<string> {
  const seen = new Map<string, number>();
  for (const page of pages) {
    for (const key of new Set(page.split(/\r?\n/).map((line) => fold(line).replace(/\s+/g, " ").trim()))) {
      if (key.length >= 4) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
}

/**
 * The Experience and Projects sections of a resume, one string per page (or
 * all the text). Page headers/footers, phone numbers and any line naming the
 * applicant are dropped first, so they can't slip into a section.
 */
export function cleanResumeText(pages: string[] | string, identity?: ResumeIdentity): CleanResume {
  const list = typeof pages === "string" ? [pages] : pages;
  const repeated = repeatedLines(list);
  const namesThem = identityTest(identity);
  const text = list
    .flatMap((page) => page.split(/\r?\n/))
    .filter((line) => !repeated.has(fold(line).replace(/\s+/g, " ").trim()))
    .filter((line) => !namesThem?.(line))
    .map((line) => line.replace(PHONE, ""))
    .join("\n");

  const sections = extractSections(text);
  if (meaningfulChars([...sections.experience, ...sections.projects].flat().join(" ")) < MIN_SECTION_CHARS) {
    return { ok: false, reason: "Couldn't find an Experience or Projects section (it may be a scanned image or an unusual layout)." };
  }
  return { ok: true, ...sections };
}

type TextItem = { str: string; transform?: number[]; width?: number };
type Segment = { x: number; y: number; end: number; text: string };

/** A gap wider than this (in PDF points) on one line means separate pieces of text, e.g. two columns. */
const COLUMN_GAP = 24;

/**
 * One page's text items as lines, reading a two-column layout one column at a
 * time so a sidebar (school, contact details) isn't glued onto the main
 * column's lines.
 */
export function pageLines(items: TextItem[], pageWidth: number): string[] {
  const pieces = items
    .filter((item) => typeof item.str === "string" && item.str.trim() && item.transform)
    .map((item) => ({ x: item.transform![4], y: item.transform![5], end: item.transform![4] + (item.width ?? 0), text: item.str }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  // Rows of items on the same baseline, split into segments wherever there's a wide gap.
  const rows: Segment[][] = [];
  for (const piece of pieces) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - piece.y) <= 2) {
      const last = row.at(-1)!;
      if (piece.x - last.end > COLUMN_GAP) row.push({ ...piece });
      else {
        last.text += piece.x - last.end > 1 && !last.text.endsWith(" ") && !piece.text.startsWith(" ") ? ` ${piece.text}` : piece.text;
        last.end = Math.max(last.end, piece.end);
      }
    } else {
      rows.push([{ ...piece }]);
    }
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);

  // A second column: many pieces of text start at the same x well into the
  // page, and some rows have nothing to its left (the longer column carrying
  // on). Right-aligned dates start at varying x and always sit beside a title.
  const bucketOf = (x: number) => Math.round(x / 10) * 10;
  const starts = new Map<number, number>();
  for (const segment of rows.flat()) {
    const bucket = bucketOf(segment.x);
    if (bucket > pageWidth * 0.25) starts.set(bucket, (starts.get(bucket) ?? 0) + 1);
  }
  const [boundary, count] = [...starts].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  const rightOnly = rows.filter((row) => bucketOf(row[0].x) === boundary).length;
  const segments = rows.flat();
  if (count < 4 || rightOnly < 1) return rows.map((row) => row.map((segment) => segment.text.trim()).join("  "));
  const left = segments.filter((segment) => segment.x < boundary - 5);
  const right = segments.filter((segment) => segment.x >= boundary - 5);
  return [...left, ...right].map((segment) => segment.text.trim());
}

/** Pulls the text out of a PDF, one string per page (first 5), one line per visual line. Throws on a broken or locked file. */
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  // The worker module registers itself on globalThis, so pdfjs runs in this
  // process instead of trying to spawn a worker (and it's traced into the build).
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // verbosity 0: errors only (no font warnings; only the text is needed).
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 5); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(pageLines(content.items as TextItem[], page.getViewport({ scale: 1 }).width).join("\n"));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** All pages' text joined. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  return (await extractPdfPages(bytes)).join("\n");
}
