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

export function isValidRedirectPath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  return true;
}

const STORAGE_KEY = "hackhive_application_draft";
const SUBMISSION_ID_KEY = "hackhive_submission_id";

export interface StoredDraft {
  data: Record<string, unknown>;
  submissionId: string;
  _savedAt: number;
}

export function saveDraftToLocalStorage(data: Record<string, unknown>, submissionId: string): void {
  try {
    const stored: StoredDraft = {
      data,
      submissionId,
      _savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error("Failed to save draft to localStorage:", e);
  }
}

export function loadDraftFromLocalStorage(): StoredDraft | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.data && parsed.submissionId) {
      return parsed as StoredDraft;
    }
    if (!parsed.submissionId) {
      return {
        data: parsed,
        submissionId: generateSubmissionId(),
        _savedAt: parsed._savedAt || Date.now(),
      };
    }
    return null;
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

export function getOrCreateSubmissionId(): string {
  try {
    const stored = loadDraftFromLocalStorage();
    if (stored?.submissionId) {
      return stored.submissionId;
    }
    const existing = localStorage.getItem(SUBMISSION_ID_KEY);
    if (existing) {
      return existing;
    }
    const newId = generateSubmissionId();
    localStorage.setItem(SUBMISSION_ID_KEY, newId);
    return newId;
  } catch {
    return generateSubmissionId();
  }
}

let saveDraftQueue: Promise<void> = Promise.resolve();

export function enqueueSaveDraft(saveFn: () => Promise<void>): void {
  saveDraftQueue = saveDraftQueue.then(saveFn).catch(() => {});
}
