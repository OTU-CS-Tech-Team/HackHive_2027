import { describe, expect, it } from 'vitest';
import { hexesFilled, shortName } from '../src/lib/passport';

describe('passport', () => {
  it('shortens names to first name + last initial', () => {
    expect(shortName('Amitav  van singh')).toBe('Amitav S.');
    expect(shortName('Cher')).toBe('Cher');
    expect(shortName('   ')).toBe('Hacker');
    expect(shortName(null)).toBe('Hacker');
  });

  it('lights one hex per 20 points, capped at 9', () => {
    expect(hexesFilled(120)).toBe(6);
    expect(hexesFilled(19)).toBe(0);
    expect(hexesFilled(5000)).toBe(9);
  });
});
