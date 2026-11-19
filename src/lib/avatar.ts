// What a hacker can put on their passport bee. The art is drawn in
// src/app/dashboard/avatar/Bee.tsx; profiles.avatar stores one { item, color } per slot.

export const COLORS = {
  ink: "Black",
  honey: "Honey",
  cream: "Cream",
  red: "Red",
  blue: "Blue",
  green: "Green",
  purple: "Purple",
} as const;
export type ColorId = keyof typeof COLORS;

const ALL = Object.keys(COLORS) as ColorId[];

const slot = <I extends Record<string, string>>(label: string, items: I, colors: readonly ColorId[] = ALL) => ({ label, items, colors });

export const SLOTS = {
  top: slot("Top", { hoodie: "Hoodie", varsity: "Varsity", tshirt: "T-shirt" }),
  bottom: slot("Bottom", { cargo: "Cargos", shorts: "Shorts" }),
  shoes: slot("Shoes", { sneakers: "Sneakers", none: "Bare feet" }),
  hat: slot("Hat", { none: "No hat", cap: "Cap", beanie: "Beanie" }),
  ears: slot("Headphones", { none: "None", headphones: "Headphones" }),
  glasses: slot("Glasses", { none: "None", shades: "Shades" }),
  // The visor's LED eyes. Black would vanish on the black visor.
  face: slot("Face", { happy: "Happy", eyes: "Big eyes", wink: "Wink", hearts: "Hearts", squint: "Squint" }, ALL.filter((c) => c !== "ink")),
};

export type Slot = keyof typeof SLOTS;
export const SLOT_IDS = Object.keys(SLOTS) as Slot[];
export type Avatar = { [S in Slot]: { item: keyof (typeof SLOTS)[S]["items"] & string; color: ColorId } };

// The Figma's hoodie bee.
export const DEFAULT_AVATAR: Avatar = {
  top: { item: "hoodie", color: "ink" },
  bottom: { item: "cargo", color: "ink" },
  shoes: { item: "sneakers", color: "ink" },
  hat: { item: "none", color: "ink" },
  ears: { item: "headphones", color: "ink" },
  glasses: { item: "none", color: "honey" },
  face: { item: "happy", color: "honey" },
};

const record = (value: unknown) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});

// hasOwn, so "toString" and friends aren't pieces.
function pieceOf(slot: Slot, value: unknown) {
  const { item, color } = record(value);
  const { items, colors } = SLOTS[slot];
  return typeof item === "string" && Object.hasOwn(items, item) && colors.includes(color as ColorId) ? { item, color } : null;
}

// For showing: a missing or retired piece falls back to the default one, so
// changing the wardrobe later never breaks a passport.
export function avatarOf(value: unknown): Avatar {
  const raw = record(value);
  return Object.fromEntries(SLOT_IDS.map((s) => [s, pieceOf(s, raw[s]) ?? DEFAULT_AVATAR[s]])) as Avatar;
}

// For saving: null unless every slot holds a real piece. Unknown keys are dropped.
export function parseAvatar(value: unknown): Avatar | null {
  const raw = record(value);
  return SLOT_IDS.every((s) => pieceOf(s, raw[s])) ? avatarOf(raw) : null;
}
