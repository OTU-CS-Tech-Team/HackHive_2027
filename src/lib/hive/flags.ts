import { AI_FLAGS } from "./prompt";

// Flags worked out in code, so they're saved even when the AI call fails.
export const CODE_FLAGS = ["minor", "possible_duplicate"] as const;
export type CodeFlag = (typeof CODE_FLAGS)[number];
export type HiveFlag = CodeFlag | (typeof AI_FLAGS)[number];

export const FLAG_LABELS: Record<HiveFlag, string> = {
  minor: "Minor",
  possible_duplicate: "Possible duplicate",
  off_topic: "Off-topic answer",
  nonsense: "Nonsense answer",
  prompt_injection: "Tried to instruct the AI",
  needs_visa_letter: "Needs visa letter",
};

export const isMinor = (age: number | null | undefined) => typeof age === "number" && age < 18;

export const minorNote = (age: number) => `Minor (age ${age}): guardian form and emergency contact required`;

/** Digits only, and the last 10 so "+1 (905) 555-0100" matches "905-555-0100". Too short to compare → null. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

export function codeFlags(
  app: { id: string; age: number | null; phone: string | null },
  others: { id: string; phone: string | null }[],
): CodeFlag[] {
  const flags: CodeFlag[] = [];
  if (isMinor(app.age)) flags.push("minor");
  const phone = normalizePhone(app.phone);
  if (phone && others.some((other) => other.id !== app.id && normalizePhone(other.phone) === phone)) {
    flags.push("possible_duplicate");
  }
  return flags;
}
