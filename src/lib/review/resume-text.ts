// Turns a resume PDF into text a blind reviewer can read: pulls the text out
// with pdfjs, drops the Education section and any GPA/degree line, then runs
// the scrubber. If too little text is left (a scanned image, a locked or broken
// PDF) it fails, and the card shows the original behind a warning instead.

export type CleanResume = { ok: true; text: string } | { ok: false; reason: string };

/** Less than this many letters/digits after cleaning = couldn't be read. */
export const MIN_RESUME_CHARS = 200;

const HEADINGS = [
  "education",
  "academic background",
  "academics",
  "academic history",
  "education and training",
  "education & training",
  "experience",
  "work experience",
  "professional experience",
  "relevant experience",
  "employment",
  "employment history",
  "work history",
  "internships",
  "projects",
  "personal projects",
  "technical projects",
  "selected projects",
  "side projects",
  "skills",
  "technical skills",
  "skills and interests",
  "skills & interests",
  "core competencies",
  "technologies",
  "tools",
  "languages",
  "awards",
  "honors",
  "honours",
  "awards and honors",
  "awards & honors",
  "honors & awards",
  "honours & awards",
  "achievements",
  "certifications",
  "certificates",
  "licenses and certifications",
  "volunteer",
  "volunteering",
  "volunteer experience",
  "leadership",
  "leadership experience",
  "activities",
  "extracurriculars",
  "extracurricular activities",
  "involvement",
  "publications",
  "research",
  "research experience",
  "interests",
  "hobbies",
  "summary",
  "profile",
  "about",
  "about me",
  "objective",
  "hackathons",
  "contact",
];

const EDUCATION = new Set(["education", "academic background", "academics", "academic history", "education and training", "education & training"]);

const normalizeHeading = (line: string) =>
  line
    .toLowerCase()
    .replace(/[:|•·_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The heading this line is, or null. Headings are short lines like "EDUCATION" or "Work Experience:". */
export function headingOf(line: string): string | null {
  if (line.trim().length > 40) return null;
  const heading = normalizeHeading(line);
  return HEADINGS.includes(heading) ? heading : null;
}

// Degree and grade lines say where and how far along someone is in school.
const DEGREE_LINE =
  /\b(?:c?gpa|b\.?\s?sc|b\.?\s?eng|b\.?\s?a\.?\s?sc|b\.?\s?comm?|b\.?\s?tech|m\.?\s?sc|m\.?\s?eng|m\.?\s?b\.?\s?a|ph\.?\s?d|bachelor'?s?|master'?s?|diploma|degree|associate'?s? of|honou?rs (?:bachelor|degree|program|student)|dean'?s list|deans list|graduat(?:e|ed|ion|ing)|class of|expected (?:grad|20\d\d)|coursework|cumulative|undergrad(?:uate)?|high school|secondary school|year [1-6]\b|(?:first|second|third|fourth|1st|2nd|3rd|4th)[ -]year)\b|\bB\.A\.|\bM\.A\./i;

/** Drops the Education section (heading to the next heading) and any line mentioning GPA or a degree. */
export function removeEducation(text: string): string {
  const kept: string[] = [];
  let inEducation = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = headingOf(line);
    if (heading) inEducation = EDUCATION.has(heading);
    if (inEducation || DEGREE_LINE.test(line)) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

const meaningfulChars = (text: string) => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

export function cleanResumeText(text: string, scrub: (text: string) => string): CleanResume {
  if (meaningfulChars(text) < MIN_RESUME_CHARS) {
    return { ok: false, reason: "The resume has almost no readable text (it may be a scanned image)." };
  }
  const cleaned = scrub(removeEducation(text))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (meaningfulChars(cleaned.replaceAll("[removed]", "")) < MIN_RESUME_CHARS) {
    return { ok: false, reason: "Too little was left after removing identifying details." };
  }
  return { ok: true, text: cleaned };
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
