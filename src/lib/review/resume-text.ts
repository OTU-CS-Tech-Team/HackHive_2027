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

export function cleanResumeText(text: string): CleanResume {
  const sections = extractSections(text);
  if (meaningfulChars([...sections.experience, ...sections.projects].flat().join(" ")) < MIN_SECTION_CHARS) {
    return { ok: false, reason: "Couldn't find an Experience or Projects section (it may be a scanned image or an unusual layout)." };
  }
  return { ok: true, ...sections };
}

type TextItem = { str: string; hasEOL?: boolean; transform?: number[] };

/** Pulls the text out of a PDF, one line per visual line. Throws on a broken or locked file. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
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
      const content = await (await pdf.getPage(n)).getTextContent();
      let line = "";
      let lastY: number | null = null;
      const lines: string[] = [];
      for (const raw of content.items) {
        const item = raw as TextItem;
        if (typeof item.str !== "string") continue;
        const y = item.transform?.[5] ?? null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line) {
          lines.push(line);
          line = "";
        }
        line += item.str;
        lastY = y;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }
    return pages.join("\n");
  } finally {
    await task.destroy();
  }
}
