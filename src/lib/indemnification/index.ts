import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type IndemnificationApplicant = {
  firstName: string;
  lastName: string;
  university: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
};

const TEMPLATE_PATH = path.join(process.cwd(), "src/lib/indemnification/template.pdf");
const TEMPLATE_PAGE_COUNT = 5;

const ONTARIO_TECH_NAMES: ReadonlySet<string> = new Set([
  "ontario tech university",
  "ontario tech",
  "ontariotechu",
  "otu",
  "university of ontario institute of technology",
  "uoit",
]);

type GuestStamp =
  | { readonly role: "ontario-tech" }
  | { readonly role: "external-guest"; readonly signedName: string; readonly date: string };

const FONT_SIZE = 12;
const MIN_FONT_SIZE = 6;
const LINE_HEIGHT = 13.4;

// Positions of the flattened text boxes in template.pdf, in PDF points from the
// bottom-left. y is the first baseline, matching the text already on the form.
const BOXES = {
  fullLegalName: { page: 1, x: 206, y: 337.3, width: 331 },
  background: { page: 1, x: 207, y: 200.1, width: 330 },
  profileLinks: { page: 1, x: 206, y: 119.1, width: 330 },
  guestName: { page: 4, x: 176, y: 442.3, width: 187 },
  guestDate: { page: 4, x: 402, y: 442.3, width: 144 },
  guestSignature: { page: 4, x: 191, y: 414.3, width: 356 },
} as const;

type Box = (typeof BOXES)[keyof typeof BOXES];

function isOntarioTech(university: string): boolean {
  const key = university
    .trim()
    .normalize("NFC")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return ONTARIO_TECH_NAMES.has(key);
}

function fullLegalName(applicant: IndemnificationApplicant): string {
  return `${applicant.firstName.trim()} ${applicant.lastName.trim()}`.trim();
}

function torontoDate(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function guestStamp(applicant: IndemnificationApplicant, at: Date): GuestStamp {
  if (isOntarioTech(applicant.university)) return { role: "ontario-tech" };
  return { role: "external-guest", signedName: fullLegalName(applicant), date: torontoDate(at) };
}

let template: Promise<Uint8Array> | null = null;

function loadTemplate(): Promise<Uint8Array> {
  template ??= readFile(TEMPLATE_PATH);
  return template;
}

// The standard fonts only encode WinAnsi; anything else would make drawText throw.
function encodable(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text, (ch) => (supported.has(ch.codePointAt(0)!) ? ch : "?")).join("");
}

function drawLine(page: PDFPage, font: PDFFont, text: string, box: Box, y: number) {
  const width = font.widthOfTextAtSize(text, FONT_SIZE);
  const size = Math.max(MIN_FONT_SIZE, Math.min(FONT_SIZE, (FONT_SIZE * box.width) / width));
  page.drawText(text, { x: box.x, y, size, font });
}

function drawLines(pages: PDFPage[], font: PDFFont, box: Box, lines: string[]) {
  lines.forEach((line, i) => {
    if (line) drawLine(pages[box.page], font, encodable(font, line), box, box.y - i * LINE_HEIGHT);
  });
}

function drawWrapped(pages: PDFPage[], font: PDFFont, box: Box, text: string) {
  pages[box.page].drawText(encodable(font, text), {
    x: box.x,
    y: box.y,
    size: FONT_SIZE,
    font,
    maxWidth: box.width,
    lineHeight: LINE_HEIGHT,
  });
}

export async function previewFilledForm(applicant: IndemnificationApplicant, at: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await loadTemplate());
  const pages = doc.getPages();
  if (pages.length !== TEMPLATE_PAGE_COUNT) {
    throw new Error(`Indemnification template has ${pages.length} pages, expected ${TEMPLATE_PAGE_COUNT}`);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);

  drawLines(pages, font, BOXES.fullLegalName, [fullLegalName(applicant)]);
  drawWrapped(pages, font, BOXES.background, applicant.university.trim());
  drawLines(
    pages,
    font,
    BOXES.profileLinks,
    [applicant.linkedinUrl, applicant.githubUrl, applicant.portfolioUrl].map((url) => url.trim()).filter(Boolean),
  );

  const stamp = guestStamp(applicant, at);
  if (stamp.role === "external-guest") {
    drawLines(pages, font, BOXES.guestName, [stamp.signedName]);
    drawLines(pages, font, BOXES.guestDate, [stamp.date]);
    drawLines(pages, font, BOXES.guestSignature, [stamp.signedName]);
  }

  return doc.save();
}
