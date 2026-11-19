// Passport maths, kept out of the client component so tests can import it.

export const HEX_COUNT = 9;
// ponytail: flat 20 pts per hex (the design shows 120 pts = 6 of 9 lit); switch to tiers if totals routinely pass 180.
export const POINTS_PER_HEX = 20;

export const hexesFilled = (points: number) => Math.max(0, Math.min(HEX_COUNT, Math.floor(points / POINTS_PER_HEX)));

// "Amitav Singh" -> "Amitav S."
export function shortName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Hacker";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}
