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

export function isValidRedirectPath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  if (/^\/[a-zA-Z]:/.test(path)) return false;
  try {
    const url = new URL(path, "http://localhost");
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.host !== "localhost") return false;
  } catch {
    return false;
  }
  return true;
}

const STORAGE_KEY_PREFIX = "hackhive_application_draft_";
const SUBMISSION_ID_KEY_PREFIX = "hackhive_submission_id_";

export interface StoredDraft {
  data: Record<string, unknown>;
  submissionId: string;
  _savedAt: number;
  userId: string;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function getSubmissionIdKey(userId: string): string {
  return `${SUBMISSION_ID_KEY_PREFIX}${userId}`;
}

export function saveDraftToLocalStorage(data: Record<string, unknown>, submissionId: string, userId: string): void {
  try {
    const stored: StoredDraft = {
      data,
      submissionId,
      _savedAt: Date.now(),
      userId,
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(stored));
  } catch (e) {
    console.error("Failed to save draft to localStorage:", e);
  }
}

export function loadDraftFromLocalStorage(userId: string): StoredDraft | null {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.userId && parsed.userId !== userId) {
      return null;
    }
    if (parsed.data && parsed.submissionId) {
      return { ...parsed, userId } as StoredDraft;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDraftFromLocalStorage(userId: string): void {
  try {
    localStorage.removeItem(getStorageKey(userId));
    localStorage.removeItem(getSubmissionIdKey(userId));
  } catch {
    // Ignore
  }
}

export function getOrCreateSubmissionId(userId: string): string {
  try {
    const stored = loadDraftFromLocalStorage(userId);
    if (stored?.submissionId) {
      return stored.submissionId;
    }
    const existing = localStorage.getItem(getSubmissionIdKey(userId));
    if (existing) {
      return existing;
    }
    const newId = generateSubmissionId();
    localStorage.setItem(getSubmissionIdKey(userId), newId);
    return newId;
  } catch {
    return generateSubmissionId();
  }
}

let saveDraftQueue: Promise<void> = Promise.resolve();

export function enqueueSaveDraft(saveFn: () => Promise<void>): void {
  saveDraftQueue = saveDraftQueue.then(saveFn).catch(() => {});
}
