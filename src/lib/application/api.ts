"use server";

import type { Application, DraftApplication } from "./schema";

export type SaveDraftResult =
  | { ok: true; savedAt: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export type SubmitResult =
  | { ok: true; applicationId: string; submittedAt: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export type ResumeUploadResult =
  | { ok: true; path: string; signedUrl: string; token: string }
  | { ok: false; code: ErrorCode; error: string };

export type GetApplicationResult =
  | { ok: true; application: Application }
  | { ok: false; code: ErrorCode; error: string };

export type ErrorCode =
  | "validation"
  | "rate_limited"
  | "turnstile"
  | "too_fast"
  | "locked"
  | "already_submitted"
  | "not_verified"
  | "server";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  validation: "Please fix the errors in the form and try again.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  turnstile: "Security verification failed. Please refresh and try again.",
  too_fast: "Please take more time to fill out the form before submitting.",
  locked: "Applications are now closed. The deadline has passed.",
  already_submitted: "You have already submitted your application.",
  not_verified: "Please verify your email before submitting.",
  server: "Something went wrong. Please try again later.",
};

export async function saveDraft(fields: Partial<DraftApplication>): Promise<SaveDraftResult> {
  await new Promise((r) => setTimeout(r, 300));

  console.log("[STUB] saveDraft called with:", Object.keys(fields));

  return {
    ok: true,
    savedAt: new Date().toISOString(),
  };
}

export interface SubmitApplicationParams {
  turnstileToken: string;
  startedAt: number;
  website: string;
  submissionId: string;
}

export async function submitApplication(
  fields: Omit<Application, "id" | "user_id" | "status" | "submitted_at" | "created_at" | "updated_at">,
  params: SubmitApplicationParams
): Promise<SubmitResult> {
  await new Promise((r) => setTimeout(r, 500));

  console.log("[STUB] submitApplication called");
  console.log("  fields:", Object.keys(fields));
  console.log("  turnstileToken:", params.turnstileToken ? "[present]" : "[missing]");
  console.log("  startedAt:", params.startedAt);
  console.log("  website (honeypot):", params.website);
  console.log("  submissionId:", params.submissionId);

  return {
    ok: true,
    applicationId: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };
}

export async function getResumeUploadUrl(): Promise<ResumeUploadResult> {
  await new Promise((r) => setTimeout(r, 200));

  console.log("[STUB] getResumeUploadUrl called");

  const path = `resumes/${crypto.randomUUID()}.pdf`;

  return {
    ok: true,
    path,
    signedUrl: `https://example.supabase.co/storage/v1/object/sign/${path}?token=stub`,
    token: "stub-token",
  };
}

export async function getMyApplication(): Promise<GetApplicationResult> {
  await new Promise((r) => setTimeout(r, 200));

  console.log("[STUB] getMyApplication called");

  return {
    ok: false,
    code: "server",
    error: "No application found (stub)",
  };
}
