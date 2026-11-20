import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, avatarOf, parseAvatar } from '../src/lib/avatar';

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
