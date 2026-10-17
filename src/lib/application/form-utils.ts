import { COMMON_TYPOS } from "@/lib/constants";

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function suggestEmailCorrection(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;

  const domain = parts[1].toLowerCase();
  const suggestion = COMMON_TYPOS[domain];

  if (suggestion) {
    return `${parts[0]}@${suggestion}`;
  }

  return null;
}

export function generateSubmissionId(): string {
  return crypto.randomUUID();
}

export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024;

  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are allowed" };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "File size must be 5 MB or less" };
  }

  return { valid: true };
}

export function isDeadlinePassed(deadline: Date): boolean {
  return new Date() > deadline;
}

const STORAGE_KEY = "hackhive_application_draft";

export function saveDraftToLocalStorage(data: Record<string, unknown>): void {
  try {
    const existing = loadDraftFromLocalStorage();
    const merged = { ...existing, ...data, _savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error("Failed to save draft to localStorage:", e);
  }
}

export function loadDraftFromLocalStorage(): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearDraftFromLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
