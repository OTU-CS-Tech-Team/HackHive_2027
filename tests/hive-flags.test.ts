import { describe, expect, it } from 'vitest';
import { codeFlags, isMinor, minorNote, normalizePhone } from '@/lib/hive/flags';

describe('isMinor', () => {
  it.each([
    [13, true],
    [17, true],
    [18, false],
    [30, false],
    [null, false],
  ])('age %s → %s', (age, minor) => {
    expect(isMinor(age)).toBe(minor);
  });

  it('writes the note admins see', () => {
    expect(minorNote(16)).toBe('Minor (age 16): guardian form and emergency contact required');
  });
});

describe('normalizePhone', () => {
  it('matches the same number written different ways', () => {
    expect(normalizePhone('+1 (905) 555-0100')).toBe('9055550100');
    expect(normalizePhone('905.555.0100')).toBe('9055550100');
  });

  it('ignores blanks and fragments', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('codeFlags', () => {
  const me = { age: 20 };

  it('flags nothing for an adult with a unique phone', () => {
    expect(codeFlags(me, false)).toEqual([]);
  });

  it('flags minors', () => {
    expect(codeFlags({ age: 17 }, false)).toEqual(['minor']);
  });

  it('flags a duplicate phone', () => {
    expect(codeFlags(me, true)).toEqual(['possible_duplicate']);
    expect(codeFlags({ age: 16 }, true)).toEqual(['minor', 'possible_duplicate']);
  });
});
