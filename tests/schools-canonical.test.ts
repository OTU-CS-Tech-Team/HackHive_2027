import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { canonicalSchoolName } from '@/lib/schools-server';
import { isOntarioTech } from '@/lib/schools';

describe('canonicalSchoolName (draft load)', () => {
  it.each([
    ['University of British Columbia', 'The University of British Columbia'],
    ['Columbia University', 'Columbia University in the City of New York'],
    ['Humber Polytechnic', 'Humber College'],
    ['University of Ontario Institute of Technology', 'Ontario Tech University'],
    ['Ontario Tech University', 'Ontario Tech University'],
  ])('maps old spelling %j to %j', (saved, name) => {
    expect(canonicalSchoolName(saved)).toBe(name);
  });

  it('leaves unknown, ambiguous and empty values as saved', () => {
    expect(canonicalSchoolName('Some Unlisted Academy')).toBe('Some Unlisted Academy');
    expect(canonicalSchoolName('UW')).toBe('UW');
    expect(canonicalSchoolName('')).toBe('');
  });

  it('keeps Ontario Tech classification unchanged', () => {
    for (const saved of ['UOIT', 'OTU', 'University of Ontario Institute of Technology', 'Ontario Tech University']) {
      expect(isOntarioTech(canonicalSchoolName(saved))).toBe(true);
    }
    expect(isOntarioTech(canonicalSchoolName('University of British Columbia'))).toBe(false);
  });
});
