import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HARDWARE_GROUPS, hardwareImage, itemRequestSchema } from '@/lib/itemRequests';

const parse = (items: { category: 'hardware' | 'toiletries' | 'other'; name: string; quantity: number }[]) =>
  itemRequestSchema.safeParse({ items, teamMembers: '', details: '' });

describe('item request hardware rules', () => {
  it('lists every hardware item once', () => {
    const names = HARDWARE_GROUPS.flatMap((group) => group.items);
    expect(new Set(names).size).toBe(names.length);
  });

  it('accepts one of each hardware item', () => {
    expect(
      parse([
        { category: 'hardware', name: 'Raspberry Pi 4B Kit', quantity: 1 },
        { category: 'hardware', name: 'Multimeter', quantity: 1 },
      ]).success,
    ).toBe(true);
  });

  it('rejects more than one of a hardware item', () => {
    expect(parse([{ category: 'hardware', name: 'Breadboard', quantity: 2 }]).success).toBe(false);
  });

  it('rejects the same hardware item twice', () => {
    expect(
      parse([
        { category: 'hardware', name: 'Breadboard', quantity: 1 },
        { category: 'hardware', name: 'Breadboard', quantity: 1 },
      ]).success,
    ).toBe(false);
  });

  it('rejects hardware that is not on the list', () => {
    expect(parse([{ category: 'hardware', name: 'Oscilloscope', quantity: 1 }]).success).toBe(false);
  });

  it('still allows several of a toiletry or other item', () => {
    expect(
      parse([
        { category: 'toiletries', name: 'Toothbrush', quantity: 2 },
        { category: 'other', name: 'Phone charger', quantity: 2 },
      ]).success,
    ).toBe(true);
  });
});

describe('hardware photos', () => {
  it('has a photo in public/ for every hardware item', () => {
    const missing = HARDWARE_GROUPS.flatMap((group) => group.items).filter(
      (name) => !existsSync(join(process.cwd(), 'public', hardwareImage(name))),
    );
    expect(missing).toEqual([]);
  });
});
