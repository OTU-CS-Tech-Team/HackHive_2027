import { SCHOOLS, compact } from "@/lib/schools";

// Blind review: strips anything that could identify an applicant from text a
// reviewer will read (short answers, the AI's reasoning, resume text). Plain
// code, so it's tested (tests/review-scrub.test.ts). Each hit becomes REMOVED.
//
// It errs on the side of removing too much: a stray "[removed]" in a sentence
// is fine, a school name slipping through is not.

export const REMOVED = "[removed]";

/** What we know about this applicant that could appear in their own text. */
export type Identity = {
  names?: (string | null | undefined)[];
  email?: string | null;
  phone?: string | null;
  school?: string | null;
  program?: string | null;
  city?: string | null;
  links?: (string | null | undefined)[];
};

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
// Full links, plus bare domains like github.com/name or janedoe.dev. Some TLDs
// double as tech names (socket.io, ASP.NET), so those only count with a path.
const URL_PATTERN = new RegExp(
  [
    String.raw`\b(?:https?:\/\/|www\.)[^\s<>()"']+`,
    String.raw`\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:github\.io|vercel\.app|netlify\.app|pages\.dev|com|ca|dev|me|org|xyz|site|page|tech|info|edu|co|uk|us)\b(?:\/[^\s<>()"']*)?`,
    String.raw`\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:io|net|app|ai)\/[^\s<>()"']*`,
  ].join("|"),
  "gi",
);
// 905-555-0100, (905) 555-0100, +1 905 555 0100, 9055550100, +44 20 7946 0958.
// Separators are required unless it's a 10/11-digit run, so big numbers and year ranges stay.
const PHONE = new RegExp(
  [
    String.raw`(?<!\d)(?:\+?1[\s.-]?)?(?:\(\d{3}\)[\s.-]?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?!\d)`,
    String.raw`(?<!\d)\+?1?\d{10}(?!\d)`,
    String.raw`\+\d{1,3}(?:[\s.-]?\d{2,4}){2,4}(?!\d)`,
  ].join("|"),
  "g",
);

const LETTER = "\\p{L}\\p{N}";
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "é" also matches "e" and so on, so "Universite de Montreal" is caught too.
function letterClass(char: string): string {
  const folded = char.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  if (folded && folded !== char && folded.length === 1) return `[${escapeRegex(char)}${escapeRegex(folded)}]`;
  return escapeRegex(char);
}

/** A loose pattern for a phrase: any spacing/punctuation between words, optional apostrophes, accent-insensitive. */
function phrasePattern(phrase: string): string {
  const words = phrase
    .trim()
    .split(/[\s.,&/-]+/)
    .filter(Boolean)
    .map((word) => {
      const letters = [...word].map((char) => (char === "'" || char === "’" ? "['’]?" : letterClass(char)));
      // "Queens" also matches "Queen’s".
      if (/[^'’]s$/i.test(word)) letters.splice(-1, 0, "['’]?");
      return letters.join("");
    });
  return words.join("[\\s.,&/-]*");
}

/** Acronyms like "U of T" / "U.B.C.": optional dots or spaces between the letters. */
function acronymPattern(acronym: string): string {
  return [...acronym].map(escapeRegex).join("[\\s.]?");
}

const STOPWORDS = new Set(["of", "the", "at", "and", "de", "du", "d", "la", "le", "l", "a"]);

/** Short all-caps-ish aliases (OTU, UofT, MIT) are matched case-sensitively, so ordinary words like "ut" or "mit" stay. */
const isAcronym = (alias: string) => !/\s/.test(alias) && alias.length <= 5 && (alias.match(/[A-Z]/g)?.length ?? 0) >= 2;

function schoolTerms() {
  const loose = new Set<string>();
  const exact = new Set<string>();
  const anyCase = new Set<string>();
  for (const school of SCHOOLS) {
    loose.add(school.name);
    for (const alias of school.aliases ?? []) {
      if (isAcronym(alias)) {
        exact.add(alias);
        if (compact(alias).length >= 4) anyCase.add(alias); // "uoft", "utsc": not English words
      } else {
        loose.add(alias);
      }
    }
    // Initials of the name ("SFU", "NYU"). Two letters are too easy to hit by accident unless listed.
    const initials = school.name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^A-Za-z]+/)
      .filter((word) => word && !STOPWORDS.has(word.toLowerCase()))
      .map((word) => word[0].toUpperCase())
      .join("");
    if (initials.length >= 3) exact.add(initials);
  }
  return { loose, exact, anyCase };
}

const bounded = (pattern: string) => `(?<![${LETTER}])(?:${pattern})(?![${LETTER}])`;
const byLength = (a: string, b: string) => b.length - a.length;

function buildSchoolRegexes() {
  const { loose, exact, anyCase } = schoolTerms();
  return [
    new RegExp(bounded([...loose].sort(byLength).map(phrasePattern).join("|")), "giu"),
    new RegExp(bounded([...exact].sort(byLength).map(acronymPattern).join("|")), "gu"),
    new RegExp(bounded([...anyCase].sort(byLength).map(acronymPattern).join("|")), "giu"),
  ];
}

const SCHOOL_REGEXES = buildSchoolRegexes();

/** The last useful part of a link: the GitHub/LinkedIn handle, or a personal domain's name. */
function linkHandles(link: string): string[] {
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    const parts = url.pathname.split("/").filter((part) => part && !["in", "pub", "u", "user", "profile"].includes(part.toLowerCase()));
    const host = url.hostname.replace(/^www\./, "").split(".")[0];
    const generic = ["github", "linkedin", "gitlab", "behance", "dribbble", "medium", "twitter", "x", "instagram", "devpost"];
    return [...parts, ...(generic.includes(host) ? [] : [host])].map(decodeURIComponent).filter((part) => part.length >= 3);
  } catch {
    return [];
  }
}

/** Words and phrases specific to this applicant, longest first. */
function identityTerms(identity: Identity): string[] {
  const terms = new Set<string>();
  const add = (value: string | null | undefined, minLength = 2) => {
    const trimmed = value?.trim();
    // Needs a letter or digit, or the pattern would match everywhere.
    if (trimmed && trimmed.length >= minLength && /[\p{L}\p{N}]/u.test(trimmed)) terms.add(trimmed);
  };
  for (const name of identity.names ?? []) {
    add(name);
    for (const part of name?.split(/[\s-]+/) ?? []) add(part.replace(/[.,]/g, ""));
  }
  if (identity.email) {
    const local = identity.email.split("@")[0];
    add(local, 3);
    for (const part of local.split(/[._+-]+/)) add(part.replace(/\d+$/, ""), 3);
  }
  add(identity.school);
  add(identity.program, 3);
  add(identity.city);
  for (const link of identity.links ?? []) {
    for (const handle of link ? linkHandles(link) : []) add(handle);
  }
  return [...terms].sort(byLength);
}

/** Digits of a phone in any spacing, e.g. 905 555 0100 written oddly. */
function phonePattern(phone: string | null | undefined): RegExp | null {
  const digits = (phone ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length < 7) return null;
  return new RegExp([...digits].join("[\\s().-]*"), "g");
}

/** A scrubber for one applicant. Reuse it for all of their text. */
export function makeScrubber(identity: Identity): (text: string | null | undefined) => string {
  const terms = identityTerms(identity);
  const personal = terms.length ? new RegExp(bounded(terms.map(phrasePattern).join("|")), "giu") : null;
  const phone = phonePattern(identity.phone);

  return (text) => {
    if (!text) return "";
    let out = text.replace(EMAIL, REMOVED).replace(URL_PATTERN, REMOVED);
    if (phone) out = out.replace(phone, REMOVED);
    out = out.replace(PHONE, REMOVED);
    if (personal) out = out.replace(personal, REMOVED);
    for (const regex of SCHOOL_REGEXES) out = out.replace(regex, REMOVED);
    // "[removed] [removed]" → one, so a full name reads as a single gap.
    return out.replace(/\[removed\](?:[\s.,'’-]*\[removed\])+/g, REMOVED);
  };
}
