// School matching for the application form.
//
// The school options come from MLH's verified school list (src/data/mlh-schools.json,
// rebuilt with `npm run schools:build`). That list is ~20k names, so it stays on the
// server: the form searches it through /api/schools (see schools-server.ts).
//
// `SCHOOLS` below is a small curated layer on top of it. Every `name` is spelled
// exactly as in MLH's list (a test checks this), so picking one saves an MLH name.
// Curated schools are ranked ahead of the rest of the list, and their `aliases`
// are what people actually type (acronyms, old names, nicknames). An MLH entry
// whose name is one of a curated school's aliases is folded into that school, so
// "University of Ontario Institute of Technology" only shows up as Ontario Tech.
//
// Initials of the name are matched automatically, so only list the ones that
// can't be derived. Matching ignores case, spaces, dots, apostrophes and accents,
// so "U of T", "UofT" and "u.of.t" are the same alias.
//
// This file must not import the MLH list: isOntarioTech is used server-side by
// the indemnification form and only needs the curated Ontario Tech names.

export type School = { readonly name: string; readonly aliases?: readonly string[] };

export const ONTARIO_TECH = "Ontario Tech University";
/** Ontario Tech's former name, also in MLH's list. Saved applications may use either. */
export const ONTARIO_TECH_FORMER = "University of Ontario Institute of Technology";

export const SCHOOLS: readonly School[] = [
  // Ontario universities
  { name: ONTARIO_TECH, aliases: ["OTU", "UOIT", "Ontario Tech", "OntarioTechU", "Ontario Tech U", ONTARIO_TECH_FORMER] },
  { name: "University of Toronto", aliases: ["UofT", "UT", "UTSC", "UTM", "UTSG", "U of T Scarborough", "U of T Mississauga"] },
  { name: "Toronto Metropolitan University", aliases: ["TMU", "Ryerson", "Ryerson University"] },
  { name: "York University", aliases: ["YorkU"] },
  { name: "University of Waterloo", aliases: ["UW", "UWaterloo", "Waterloo"] },
  { name: "Wilfrid Laurier University", aliases: ["WLU", "Laurier"] },
  { name: "McMaster University", aliases: ["Mac"] },
  { name: "Queen's University", aliases: ["Queens", "QU"] },
  { name: "Western University", aliases: ["UWO", "Western", "Western Ontario", "University of Western Ontario"] },
  { name: "University of Ottawa", aliases: ["uOttawa", "UO", "Université d'Ottawa"] },
  { name: "Carleton University", aliases: ["CU"] },
  { name: "University of Guelph", aliases: ["UofG", "UGuelph"] },
  { name: "Brock University", aliases: ["BrockU"] },
  { name: "Trent University", aliases: ["Trent Durham"] },
  { name: "University of Windsor", aliases: ["UWindsor"] },
  { name: "Lakehead University" },
  { name: "Laurentian University" },
  { name: "Nipissing University" },
  { name: "Algoma University" },
  { name: "OCAD University", aliases: ["OCAD", "OCADU"] },

  // Ontario colleges
  { name: "Durham College", aliases: ["DC", "Durham"] },
  { name: "Sheridan College Institute of Technology and Advanced Learning", aliases: ["Sheridan", "Sheridan College"] },
  { name: "Seneca Polytechnic", aliases: ["Seneca", "Seneca College"] },
  { name: "Humber College", aliases: ["Humber", "Humber Polytechnic"] },
  { name: "George Brown College", aliases: ["George Brown", "GBC"] },
  { name: "Centennial College", aliases: ["Centennial"] },
  { name: "Conestoga College", aliases: ["Conestoga"] },
  { name: "Fleming College", aliases: ["Fleming"] },

  // Quebec
  { name: "McGill University", aliases: ["McGill"] },
  { name: "Concordia University", aliases: ["ConU", "Concordia"] },
  { name: "University of Montreal", aliases: ["UdeM", "Université de Montréal"] },
  { name: "École Polytechnique de Montréal", aliases: ["Poly", "PolyMTL", "Polytechnique", "Polytechnique Montréal"] },
  { name: "Université du Québec – Engineering School - University of Quebec", aliases: ["ETS", "École de technologie supérieure"] },
  { name: "Laval University", aliases: ["ULaval", "Laval", "Université Laval"] },
  { name: "University of Sherbrooke", aliases: ["UdeS", "Sherbrooke", "Université de Sherbrooke"] },
  { name: "University of Quebec – University of Quebec - Montreal", aliases: ["UQAM", "Université du Québec à Montréal"] },
  { name: "Bishop's University", aliases: ["Bishops"] },

  // British Columbia
  { name: "The University of British Columbia", aliases: ["UBC", "UBCO", "UBC Okanagan", "University of British Columbia"] },
  { name: "Simon Fraser University", aliases: ["SFU"] },
  { name: "University of Victoria", aliases: ["UVic"] },
  { name: "British Columbia Institute of Technology", aliases: ["BCIT"] },
  { name: "Thompson Rivers University", aliases: ["TRU"] },
  { name: "University of Northern British Columbia", aliases: ["UNBC"] },

  // Prairies
  { name: "University of Alberta", aliases: ["UofA", "UAlberta"] },
  { name: "University of Calgary", aliases: ["UofC", "UCalgary"] },
  { name: "University of Lethbridge", aliases: ["ULeth", "ULethbridge"] },
  { name: "Mount Royal University", aliases: ["MRU"] },
  { name: "Grant MacEwan University", aliases: ["MacEwan", "MacEwan University"] },
  { name: "University of Saskatchewan", aliases: ["USask", "UofS"] },
  { name: "University of Regina", aliases: ["URegina", "UofR"] },
  { name: "University of Manitoba", aliases: ["UManitoba", "UofM"] },
  { name: "The University of Winnipeg", aliases: ["UWinnipeg", "UofW", "University of Winnipeg"] },

  // Atlantic
  { name: "Dalhousie University", aliases: ["Dal"] },
  { name: "Memorial University", aliases: ["MUN", "Memorial", "Memorial University of Newfoundland"] },
  { name: "University of New Brunswick", aliases: ["UNB"] },
  { name: "Acadia University" },
  { name: "Saint Mary's University", aliases: ["SMU", "St. Mary's"] },
  { name: "St. Francis Xavier University", aliases: ["StFX", "Saint Francis Xavier"] },
  { name: "University of Prince Edward Island", aliases: ["UPEI"] },
  { name: "Mount Allison University", aliases: ["MtA", "Mount A"] },
  { name: "University of Moncton", aliases: ["Moncton", "Université de Moncton"] },

  // Ivy League
  { name: "Harvard University", aliases: ["Harvard"] },
  { name: "Yale University", aliases: ["Yale"] },
  { name: "Princeton University", aliases: ["Princeton"] },
  { name: "Columbia University in the City of New York", aliases: ["Columbia", "Columbia University"] },
  { name: "University of Pennsylvania", aliases: ["UPenn", "Penn"] },
  { name: "Brown University", aliases: ["Brown"] },
  { name: "Dartmouth College", aliases: ["Dartmouth"] },
  { name: "Cornell University", aliases: ["Cornell"] },

  // Other big US schools
  { name: "Massachusetts Institute of Technology", aliases: ["MIT"] },
  { name: "Stanford University", aliases: ["Stanford"] },
  { name: "University of California Berkeley", aliases: ["UC Berkeley", "Berkeley", "Cal", "UCB"] },
  { name: "California Institute of Technology", aliases: ["Caltech"] },
  { name: "Carnegie Mellon University", aliases: ["CMU"] },
  { name: "Georgia Institute of Technology", aliases: ["Georgia Tech", "GT", "GaTech"] },
  { name: "University of Michigan", aliases: ["UMich", "UofM", "Michigan"] },
  { name: "University of California Los Angeles", aliases: ["UCLA"] },
  { name: "University of Illinois at Urbana - Champaign", aliases: ["UIUC", "Illinois", "University of Illinois Urbana-Champaign"] },
  { name: "University of Washington", aliases: ["UW", "UDub", "UWashington"] },
  { name: "The University of Texas at Austin", aliases: ["UT Austin", "UT", "University of Texas at Austin"] },
  { name: "Purdue University", aliases: ["Purdue"] },
  { name: "New York University", aliases: ["NYU"] },
  { name: "Johns Hopkins University", aliases: ["JHU", "Hopkins"] },
  { name: "University of Chicago", aliases: ["UChicago"] },
  { name: "Duke University", aliases: ["Duke"] },
  { name: "Northeastern University", aliases: ["NEU", "Northeastern"] },
  { name: "State University of New York at Buffalo", aliases: ["UB", "SUNY Buffalo", "Buffalo", "University at Buffalo"] },
];

const STOPWORDS = new Set(["of", "the", "at", "and", "de", "du", "d", "la", "le", "l", "a", "in"]);

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ");
}

/**
 * Lowercase, accent-free, letters and digits only: "U of T" and "u.of.t" both become "uoft".
 * Letters from any script are kept, so names in Cyrillic or Chinese stay searchable.
 */
export function compact(text: string): string {
  return fold(text).replace(/[^\p{L}\p{N}]/gu, "");
}

function words(text: string): string[] {
  return fold(text).replace(/['’]/g, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Ontario Tech under every name and alias, compacted. Kept apart from the
// search index so the indemnification form never needs the MLH list.
const ONTARIO_TECH_KEYS = new Set(
  [ONTARIO_TECH, ...(SCHOOLS.find((s) => s.name === ONTARIO_TECH)?.aliases ?? [])].map(compact),
);

/** True for Ontario Tech under its current or former name or a known alias, however it's spaced or cased. */
export function isOntarioTech(text: string): boolean {
  return ONTARIO_TECH_KEYS.has(compact(text));
}

type Indexed = {
  name: string;
  curated: boolean;
  order: number;
  key: string;
  words: string[];
  exact: Set<string>;
  initials: string;
  aliases: string[];
};

function indexEntry(school: School, curated: boolean, order: number): Indexed {
  const nameWords = words(school.name);
  const aliases = (school.aliases ?? []).map(compact);
  const initials = nameWords.filter((w) => !STOPWORDS.has(w)).map((w) => w[0]).join("");
  return {
    name: school.name,
    curated,
    order,
    key: compact(school.name),
    words: nameWords,
    exact: new Set([compact(school.name), ...aliases]),
    initials: initials.length >= 2 ? initials : "",
    aliases,
  };
}

// Lower is better; null means no match.
function rank(entry: Indexed, key: string, queryWords: string[]): number | null {
  if (entry.exact.has(key)) return 0;
  if (
    entry.initials === key ||
    entry.key.startsWith(key) ||
    entry.aliases.some((a) => a.startsWith(key)) ||
    queryWords.every((q) => entry.words.some((w) => w.startsWith(q)))
  ) {
    return 1;
  }
  if (entry.key.includes(key) || entry.aliases.some((a) => a.includes(key))) return 2;
  return null;
}

export const MAX_QUERY_LENGTH = 100;
export const DEFAULT_LIMIT = 8;

export type SchoolSearch = {
  /** Every name a result can have: the MLH list minus names folded into a curated school. */
  readonly names: readonly string[];
  /** School names matching what someone typed, best first. */
  search(query: string, limit?: number): string[];
  /** School names whose full name, or a curated alias, is exactly what was typed. */
  exact(text: string): string[];
};

/**
 * Builds the search over MLH's list with the curated schools layered on top.
 * Within a match tier, curated schools come first (in SCHOOLS order, so "toronto"
 * offers U of T before TMU), then the rest of MLH's list in its own order.
 */
export function createSchoolSearch(mlhNames: readonly string[], curated: readonly School[] = SCHOOLS): SchoolSearch {
  const curatedEntries = curated.map((school, i) => indexEntry(school, true, i));
  const folded = new Set(curatedEntries.flatMap((entry) => [...entry.exact]));

  const seen = new Set<string>();
  const rest: Indexed[] = [];
  for (const name of mlhNames) {
    const key = compact(name);
    // Skip names folded into a curated school, and spelling variants of one already listed.
    if (!key || folded.has(key) || seen.has(key)) continue;
    seen.add(key);
    rest.push(indexEntry({ name }, false, rest.length));
  }
  const index = [...curatedEntries, ...rest];

  return {
    names: index.map((entry) => entry.name),
    search(query, limit = DEFAULT_LIMIT) {
      const text = query.slice(0, MAX_QUERY_LENGTH);
      const key = compact(text);
      if (!key || limit <= 0) return [];
      const queryWords = words(text);
      const hits: { entry: Indexed; r: number }[] = [];
      for (const entry of index) {
        const r = rank(entry, key, queryWords);
        if (r !== null) hits.push({ entry, r });
      }
      return hits
        .sort((a, b) => a.r - b.r || Number(b.entry.curated) - Number(a.entry.curated) || a.entry.order - b.entry.order)
        .slice(0, limit)
        .map(({ entry }) => entry.name);
    },
    exact(text) {
      const key = compact(text.slice(0, MAX_QUERY_LENGTH));
      if (!key) return [];
      return index.filter((entry) => entry.exact.has(key)).map((entry) => entry.name);
    },
  };
}
