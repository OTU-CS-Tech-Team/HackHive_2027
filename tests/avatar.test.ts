import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, avatarOf, beeName, beeRecord, cleanName, parseAvatar } from '../src/lib/avatar';

const custom = { ...DEFAULT_AVATAR, top: { item: 'varsity', color: 'red' }, hat: { item: 'cap', color: 'honey' } };

describe('avatar', () => {
  it('shows the default bee for anything that is not an avatar', () => {
    for (const junk of [null, undefined, 'hoodie', 42, [], {}]) expect(avatarOf(junk)).toEqual(DEFAULT_AVATAR);
  });

  it('keeps real pieces and swaps only the broken ones for defaults', () => {
    // Black eyes would vanish on the black visor, so the face slot doesn't offer them.
    const stored = { ...custom, shoes: { item: 'rollerblades', color: 'ink' }, face: { item: 'happy', color: 'ink' } };
    expect(avatarOf(stored)).toEqual({ ...custom, shoes: DEFAULT_AVATAR.shoes, face: DEFAULT_AVATAR.face });
  });

  it('treats object-prototype keys as unknown', () => {
    for (const item of ['toString', '__proto__', 'constructor']) {
      expect(avatarOf({ ...custom, top: { item, color: 'red' } }).top).toEqual(DEFAULT_AVATAR.top);
    }
    expect(avatarOf({ ...custom, top: { item: 'hoodie', color: 'constructor' } }).top).toEqual(DEFAULT_AVATAR.top);
  });

  it('only saves a complete, valid avatar, and drops extra keys', () => {
    expect(parseAvatar(DEFAULT_AVATAR)).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar({ ...custom, extra: 'x' })).toEqual(custom);
    expect(parseAvatar({ ...custom, top: { item: 'cape', color: 'red' } })).toBeNull();
    const missingHat: Record<string, unknown> = { ...custom };
    delete missingHat.hat;
    expect(parseAvatar(missingHat)).toBeNull();
    expect(parseAvatar('hoodie')).toBeNull();
  });
});

describe('bee names', () => {
  it('trims, keeps one space between words, and caps at 24 characters', () => {
    expect(cleanName('  Sir   Buzz\n the Third  ')).toBe('Sir Buzz the Third');
    expect(cleanName('B'.repeat(30))).toBe('B'.repeat(24));
  });

  it('never cuts an emoji in half', () => {
    expect(cleanName('🐝'.repeat(30))).toBe('🐝'.repeat(24));
  });

  it('is blank for anything that is not text', () => {
    for (const junk of [null, undefined, 42, {}, ['Buzz'], '   ']) expect(cleanName(junk)).toBe('');
  });

  it('reads the name back from a stored bee', () => {
    expect(beeName({ ...DEFAULT_AVATAR, name: ' Buzz ' })).toBe('Buzz');
    expect(beeName(DEFAULT_AVATAR)).toBe('');
    expect(beeName(null)).toBe('');
  });

  it('stores the slots with the name, and leaves a blank name out', () => {
    expect(beeRecord(custom, ' Buzz ')).toEqual({ ...custom, name: 'Buzz' });
    expect(beeRecord(custom, '   ')).toEqual(custom);
    expect(beeRecord({ ...custom, top: { item: 'cape', color: 'red' } }, 'Buzz')).toBeNull();
  });

  it('never lets a stored name change what the bee wears', () => {
    expect(avatarOf({ ...custom, name: 'Buzz' })).toEqual(custom);
  });
});
