import { describe, expect, it, vi } from 'vitest';
import mlhSchools from '@/data/mlh-schools.json';
import { ONTARIO_TECH, ONTARIO_TECH_FORMER, SCHOOLS, compact, createSchoolSearch, isOntarioTech } from '@/lib/schools';
import { isOtu } from '@/lib/decisions/pools';
import { parseCsv, schoolNames } from '../scripts/build-mlh-schools.mjs';

vi.mock('server-only', () => ({}));

const MLH: readonly string[] = mlhSchools;
const search = createSchoolSearch(MLH);
const results = (query: string, limit?: number) => search.search(query, limit);
const top = (query: string) => results(query)[0];

// Aliases deliberately shared by two schools; both are offered, Canadian first.
const SHARED_ALIASES = new Set(['uw', 'ut', 'uofm']);

// MLH entries that are another name for a curated school, so they're folded into it.
const FOLDED = {
  'University of Ontario Institute of Technology': ONTARIO_TECH,
  'University of Western Ontario': 'Western University',
  'Seneca College': 'Seneca Polytechnic',
};

describe('MLH school list data', () => {
  it('is a cleaned, de-duplicated list of names', () => {
    expect(MLH.length).toBeGreaterThan(15000);
    expect(new Set(MLH).size).toBe(MLH.length);
    for (const name of MLH) expect(name).toBe(name.trim());
    expect(MLH.some((name) => name.startsWith('Below is a list'))).toBe(false);
  });

  it('has both of Ontario Tech\'s names', () => {
    expect(MLH).toContain(ONTARIO_TECH);
    expect(MLH).toContain(ONTARIO_TECH_FORMER);
  });
});

describe('build-mlh-schools', () => {
  it('parses quoted CSV fields, including escaped quotes and commas', () => {
    expect(parseCsv('"a, b"\r\n"say ""hi"""\n')).toEqual([['a, b'], ['say "hi"']]);
  });

  it('skips the note on the first line, trims and de-duplicates', () => {
    const csv = '"Below is a list of all schools."\n"Acadia University"\n"  Acadia University "\n"Trent University"\n\n';
    expect(schoolNames(csv)).toEqual(['Acadia University', 'Trent University']);
  });
});

describe('curated schools', () => {
  it('are all spelled exactly as in MLH\'s list', () => {
    const mlh = new Set(MLH);
    expect(SCHOOLS.filter((school) => !mlh.has(school.name)).map((s) => s.name)).toEqual([]);
  });

  it('have unique names', () => {
    const names = SCHOOLS.map((s) => compact(s.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('are found by their own name and every alias', () => {
    for (const school of SCHOOLS) {
      for (const text of [school.name, ...(school.aliases ?? [])]) {
        expect(search.exact(text), text).toContain(school.name);
        expect(results(text), text).toContain(school.name);
      }
    }
  });

  it('only share the aliases we expect', () => {
    const owners = new Map<string, string[]>();
    for (const school of SCHOOLS) {
      for (const key of new Set([school.name, ...(school.aliases ?? [])].map(compact))) {
        owners.set(key, [...(owners.get(key) ?? []), school.name]);
      }
    }
    const shared = [...owners].filter(([, names]) => names.length > 1).map(([key]) => key);
    expect(shared.sort()).toEqual([...SHARED_ALIASES].sort());
  });

  it('fold in only the MLH entries we expect', () => {
    // Not offered under any spelling (spelling variants like "St Mary's" vs "St. Mary's" are collapsed, not folded).
    const offered = new Set(search.names.map(compact));
    const folded = MLH.filter((name) => !offered.has(compact(name)));
    expect(folded.sort()).toEqual(Object.keys(FOLDED).sort());
    for (const [name, school] of Object.entries(FOLDED)) {
      expect(search.exact(name)).toEqual([school]);
      expect(top(name)).toBe(school);
    }
  });
});

describe('school search', () => {
  it.each([
    ['UOFT', 'University of Toronto'],
    ['u of t', 'University of Toronto'],
    ['u.of.t', 'University of Toronto'],
    ['ryerson', 'Toronto Metropolitan University'],
    ['sfu', 'Simon Fraser University'],
    ['ubc', 'The University of British Columbia'],
    ['queens', "Queen's University"],
    ['mcgill', 'McGill University'],
    ['universite de montreal', 'University of Montreal'],
    ['UW', 'University of Waterloo'],
    ['UWO', 'Western University'],
    ['western', 'Western University'],
    ['otu', ONTARIO_TECH],
    ['uoit', ONTARIO_TECH],
    ['ontario tech', ONTARIO_TECH],
    ['durham', 'Durham College'],
    ['seneca', 'Seneca Polytechnic'],
    ['humber', 'Humber College'],
    ['sheridan', 'Sheridan College Institute of Technology and Advanced Learning'],
    ['ets', 'Université du Québec – Engineering School - University of Quebec'],
    ['mit', 'Massachusetts Institute of Technology'],
    ['cmu', 'Carnegie Mellon University'],
    ['berkeley', 'University of California Berkeley'],
    ['tor', 'University of Toronto'],
    ['british col', 'The University of British Columbia'],
    ['oxford brookes', 'Oxford Brookes University'],
  ])('%j finds %s first', (query, name) => {
    expect(top(query)).toBe(name);
  });

  it('offers every school that shares an alias', () => {
    expect(results('UW').slice(0, 2)).toEqual(['University of Waterloo', 'University of Washington']);
  });

  it('ranks the big Canadian schools ahead of the rest of MLH\'s list', () => {
    expect(results('toronto').slice(0, 2)).toEqual(['University of Toronto', 'Toronto Metropolitan University']);
    const toronto = results('toronto', 50);
    expect(toronto).toContain('Toronto School of Management');
    expect(toronto.indexOf('Toronto School of Management')).toBeGreaterThan(1);
  });

  it('also finds schools that are only in MLH\'s list', () => {
    expect(results('university of oxford')).toContain('University of Oxford');
    expect(search.exact('university of oxford')).toEqual(['University of Oxford']);
  });

  it('finds names written in other scripts', () => {
    expect(top('安徽大学')).toBe('安徽大学');
    expect(results('Частная гимназия')).toContain('Частная гимназия Саидумар');
  });

  it('shows Ontario Tech once, under its current name', () => {
    for (const query of ['ontario', 'ontario tech', 'university of ontario institute', 'uoit', 'otu']) {
      const names = results(query, 50);
      expect(names, query).not.toContain(ONTARIO_TECH_FORMER);
      expect(names.filter((n) => n === ONTARIO_TECH), query).toHaveLength(1);
    }
    expect(search.names).not.toContain(ONTARIO_TECH_FORMER);
  });

  it('never offers a name twice', () => {
    expect(new Set(search.names.map(compact)).size).toBe(search.names.length);
  });

  it('returns nothing for blank or unknown text', () => {
    expect(results('   ')).toEqual([]);
    expect(results('zzqxzzqx')).toEqual([]);
    expect(search.exact('')).toEqual([]);
    expect(search.exact('Not A Real School Name')).toEqual([]);
  });

  it('caps the results', () => {
    expect(results('u', 5)).toHaveLength(5);
    expect(results('u')).toHaveLength(8);
  });

  it('copes with very long queries', () => {
    expect(results('a'.repeat(10000))).toEqual([]);
  });
});

describe('isOntarioTech', () => {
  it.each([
    ONTARIO_TECH,
    ONTARIO_TECH_FORMER,
    'ONTARIO TECH UNIVERSITY',
    'university of ontario institute of technology',
    '  University  of Ontario Institute of Technology. ',
    ' ontario  tech. ',
    'OTU',
    'otu',
    'U.O.I.T.',
    'OntarioTechU',
    'Ontario Tech U',
  ])('recognises %j', (text) => expect(isOntarioTech(text)).toBe(true));

  it.each(['University of Toronto', 'Ontario Tech Univeristy', 'Durham College', 'Trent University', 'University of Western Ontario', ''])(
    'rejects %j',
    (text) => expect(isOntarioTech(text)).toBe(false),
  );

  it('matches exactly Ontario Tech\'s two names in MLH\'s list, agreeing with the review pools', () => {
    expect(MLH.filter(isOntarioTech).sort()).toEqual([ONTARIO_TECH, ONTARIO_TECH_FORMER].sort());
    expect(MLH.filter((name) => isOtu(name)).sort()).toEqual([ONTARIO_TECH, ONTARIO_TECH_FORMER].sort());
  });
});
