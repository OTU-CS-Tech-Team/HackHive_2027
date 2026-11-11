// The schools applicants pick from. The picked school's `name` is what gets saved,
// so names must stay stable once applications reference them. Anyone not listed
// picks "Other" and types their school.
//
// `aliases` are what people actually type (acronyms, old names, nicknames).
// Initials of the name are matched automatically, so only list the ones that
// can't be derived. Matching ignores case, spaces, dots, apostrophes and accents,
// so "U of T", "UofT" and "u.of.t" are the same alias.

export type School = { readonly name: string; readonly aliases?: readonly string[] };

export const ONTARIO_TECH = "Ontario Tech University";

export const SCHOOLS: readonly School[] = [
  // Ontario universities
  { name: ONTARIO_TECH, aliases: ["OTU", "UOIT", "Ontario Tech", "OntarioTechU", "Ontario Tech U", "University of Ontario Institute of Technology"] },
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
  { name: "Sheridan College", aliases: ["Sheridan"] },
  { name: "Seneca Polytechnic", aliases: ["Seneca", "Seneca College"] },
  { name: "Humber Polytechnic", aliases: ["Humber", "Humber College"] },
  { name: "George Brown College", aliases: ["George Brown", "GBC"] },
  { name: "Centennial College", aliases: ["Centennial"] },
  { name: "Conestoga College", aliases: ["Conestoga"] },
  { name: "Fleming College", aliases: ["Fleming"] },

  // Quebec
  { name: "McGill University", aliases: ["McGill"] },
  { name: "Concordia University", aliases: ["ConU", "Concordia"] },
  { name: "Université de Montréal", aliases: ["UdeM", "University of Montreal"] },
  { name: "Polytechnique Montréal", aliases: ["Poly", "PolyMTL", "Polytechnique"] },
  { name: "École de technologie supérieure", aliases: ["ETS"] },
  { name: "Université Laval", aliases: ["ULaval", "Laval"] },
  { name: "Université de Sherbrooke", aliases: ["UdeS", "Sherbrooke"] },
  { name: "Université du Québec à Montréal", aliases: ["UQAM"] },
  { name: "Bishop's University", aliases: ["Bishops"] },

  // British Columbia
  { name: "University of British Columbia", aliases: ["UBC", "UBCO", "UBC Okanagan"] },
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
  { name: "MacEwan University", aliases: ["MacEwan"] },
  { name: "University of Saskatchewan", aliases: ["USask", "UofS"] },
  { name: "University of Regina", aliases: ["URegina", "UofR"] },
  { name: "University of Manitoba", aliases: ["UManitoba", "UofM"] },
  { name: "University of Winnipeg", aliases: ["UWinnipeg", "UofW"] },

  // Atlantic
  { name: "Dalhousie University", aliases: ["Dal"] },
  { name: "Memorial University of Newfoundland", aliases: ["MUN", "Memorial"] },
  { name: "University of New Brunswick", aliases: ["UNB"] },
  { name: "Acadia University" },
  { name: "Saint Mary's University", aliases: ["SMU", "St. Mary's"] },
  { name: "St. Francis Xavier University", aliases: ["StFX", "Saint Francis Xavier"] },
  { name: "University of Prince Edward Island", aliases: ["UPEI"] },
  { name: "Mount Allison University", aliases: ["MtA", "Mount A"] },
  { name: "Université de Moncton", aliases: ["Moncton"] },

  // Ivy League
  { name: "Harvard University", aliases: ["Harvard"] },
  { name: "Yale University", aliases: ["Yale"] },
  { name: "Princeton University", aliases: ["Princeton"] },
  { name: "Columbia University", aliases: ["Columbia"] },
  { name: "University of Pennsylvania", aliases: ["UPenn", "Penn"] },
  { name: "Brown University", aliases: ["Brown"] },
  { name: "Dartmouth College", aliases: ["Dartmouth"] },
  { name: "Cornell University", aliases: ["Cornell"] },

  // Other big US schools
  { name: "Massachusetts Institute of Technology", aliases: ["MIT"] },
  { name: "Stanford University", aliases: ["Stanford"] },
  { name: "University of California, Berkeley", aliases: ["UC Berkeley", "Berkeley", "Cal", "UCB"] },
  { name: "California Institute of Technology", aliases: ["Caltech"] },
  { name: "Carnegie Mellon University", aliases: ["CMU"] },
  { name: "Georgia Institute of Technology", aliases: ["Georgia Tech", "GT", "GaTech"] },
  { name: "University of Michigan", aliases: ["UMich", "UofM", "Michigan"] },
  { name: "University of California, Los Angeles", aliases: ["UCLA"] },
  { name: "University of Illinois Urbana-Champaign", aliases: ["UIUC", "Illinois"] },
  { name: "University of Washington", aliases: ["UW", "UDub", "UWashington"] },
  { name: "University of Texas at Austin", aliases: ["UT Austin", "UT"] },
  { name: "Purdue University", aliases: ["Purdue"] },
  { name: "New York University", aliases: ["NYU"] },
  { name: "Johns Hopkins University", aliases: ["JHU", "Hopkins"] },
  { name: "University of Chicago", aliases: ["UChicago"] },
  { name: "Duke University", aliases: ["Duke"] },
  { name: "Northeastern University", aliases: ["NEU", "Northeastern"] },
  { name: "University at Buffalo", aliases: ["UB", "SUNY Buffalo", "Buffalo"] },
];

const STOPWORDS = new Set(["of", "the", "at", "and", "de", "du", "d", "la", "le", "l", "a"]);

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ");
}

/** Lowercase, accent-free, letters and digits only: "U of T" and "u.of.t" both become "uoft". */
export function compact(text: string): string {
  return fold(text).replace(/[^a-z0-9]/g, "");
}

function words(text: string): string[] {
  return fold(text).replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
}

type Indexed = {
  school: School;
  order: number;
  name: string;
  words: string[];
  exact: Set<string>;
  initials: string;
  aliases: string[];
};

const INDEX: readonly Indexed[] = SCHOOLS.map((school, order) => {
  const nameWords = words(school.name);
  const aliases = (school.aliases ?? []).map(compact);
  const initials = nameWords.filter((w) => !STOPWORDS.has(w)).map((w) => w[0]).join("");
  return {
    school,
    order,
    name: compact(school.name),
    words: nameWords,
    exact: new Set([compact(school.name), ...aliases]),
    initials: initials.length >= 2 ? initials : "",
    aliases,
  };
});

// Lower is better; null means no match. Within a tier, list order decides,
// which is why "toronto" offers U of T before TMU.
function rank(entry: Indexed, key: string, queryWords: string[]): number | null {
  if (entry.exact.has(key)) return 0;
  if (
    entry.initials === key ||
    entry.name.startsWith(key) ||
    entry.aliases.some((a) => a.startsWith(key)) ||
    queryWords.every((q) => entry.words.some((w) => w.startsWith(q)))
  ) {
    return 1;
  }
  if (entry.name.includes(key) || entry.aliases.some((a) => a.includes(key))) return 2;
  return null;
}

/** Schools matching what someone typed, best first; ties keep list order (Canada first). */
export function searchSchools(query: string, limit = 8): School[] {
  const key = compact(query);
  if (!key) return [];
  const queryWords = words(query);
  return INDEX.flatMap((entry) => {
    const r = rank(entry, key, queryWords);
    return r === null ? [] : [{ entry, r }];
  })
    .sort((a, b) => a.r - b.r || a.entry.order - b.entry.order)
    .slice(0, limit)
    .map(({ entry }) => entry.school);
}

/** Schools whose full name or a listed alias is exactly what was typed. */
export function exactSchoolMatches(text: string): School[] {
  const key = compact(text);
  if (!key) return [];
  return INDEX.filter((entry) => entry.exact.has(key)).map((entry) => entry.school);
}

export function isOntarioTech(text: string): boolean {
  return exactSchoolMatches(text).some((school) => school.name === ONTARIO_TECH);
}
