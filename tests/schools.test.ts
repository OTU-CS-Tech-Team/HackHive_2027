import { describe, expect, it } from 'vitest';
import { SCHOOLS, compact, exactSchoolMatches, isOntarioTech, searchSchools } from '@/lib/schools';

const top = (query: string) => searchSchools(query)[0]?.name;

// Aliases deliberately shared by two schools; both are offered, Canadian first.
const SHARED_ALIASES = new Set(['uw', 'ut', 'uofm']);

describe('school list', () => {
  it('has unique names', () => {
    const names = SCHOOLS.map((s) => compact(s.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('finds every school by its own name and aliases', () => {
    for (const school of SCHOOLS) {
      for (const text of [school.name, ...(school.aliases ?? [])]) {
        expect(exactSchoolMatches(text).map((s) => s.name), text).toContain(school.name);
      }
    }
  });

  it('only shares the aliases we expect', () => {
    const owners = new Map<string, string[]>();
    for (const school of SCHOOLS) {
      for (const key of new Set([school.name, ...(school.aliases ?? [])].map(compact))) {
        owners.set(key, [...(owners.get(key) ?? []), school.name]);
      }
    }
    const shared = [...owners].filter(([, names]) => names.length > 1).map(([key]) => key);
    expect(shared.sort()).toEqual([...SHARED_ALIASES].sort());
  });
});

describe('searchSchools', () => {
  it.each([
    ['UOFT', 'University of Toronto'],
    ['u of t', 'University of Toronto'],
    ['u.of.t', 'University of Toronto'],
    ['ryerson', 'Toronto Metropolitan University'],
    ['sfu', 'Simon Fraser University'],
    ['ubc', 'University of British Columbia'],
    ['queens', "Queen's University"],
    ['mcgill', 'McGill University'],
    ['universite de montreal', 'Université de Montréal'],
    ['UW', 'University of Waterloo'],
    ['otu', 'Ontario Tech University'],
    ['durham', 'Durham College'],
    ['mit', 'Massachusetts Institute of Technology'],
    ['cmu', 'Carnegie Mellon University'],
    ['tor', 'University of Toronto'],
    ['british col', 'University of British Columbia'],
  ])('%j finds %s first', (query, name) => {
    expect(top(query)).toBe(name);
  });

  it('offers every school that shares an alias', () => {
    const names = searchSchools('UW').map((s) => s.name);
    expect(names.slice(0, 2)).toEqual(['University of Waterloo', 'University of Washington']);
  });

  it('lists both Toronto schools for "toronto"', () => {
    expect(searchSchools('toronto').map((s) => s.name).slice(0, 2))
      .toEqual(['University of Toronto', 'Toronto Metropolitan University']);
  });

  it('returns nothing for blank or unknown text', () => {
    expect(searchSchools('   ')).toEqual([]);
    expect(searchSchools('zzqx')).toEqual([]);
  });

  it('caps the results', () => {
    expect(searchSchools('u', 5)).toHaveLength(5);
  });
});

describe('isOntarioTech', () => {
  it.each(['Ontario Tech University', ' ontario  tech. ', 'OTU', 'U.O.I.T.', 'OntarioTechU', 'University of Ontario Institute of Technology'])(
    'recognises %j',
    (text) => expect(isOntarioTech(text)).toBe(true),
  );

  it.each(['University of Toronto', 'Ontario Tech Univeristy', 'Durham College', ''])('rejects %j', (text) => {
    expect(isOntarioTech(text)).toBe(false);
  });
});
