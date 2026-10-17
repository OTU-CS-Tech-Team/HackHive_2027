"use server";

import type { ApplicationDraft, Application, ErrorCode, SaveDraftResult, GetResumeUploadUrlResult, SubmitApplicationResult, GetMyApplicationResult } from "./schema";

export type { SaveDraftResult, GetResumeUploadUrlResult as ResumeUploadResult, SubmitApplicationResult as SubmitResult, GetMyApplicationResult as GetApplicationResult, ErrorCode };

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  validation: "Please fix the errors in the form and try again.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  turnstile: "Security verification failed. Please refresh the captcha and try again.",
  too_fast: "Please take more time to fill out the form before submitting.",
  locked: "Applications are now closed. The deadline has passed.",
  already_submitted: "You have already submitted your application.",
  not_verified: "Please verify your email before submitting.",
  server: "Something went wrong. Please try again later.",
};

type DraftFields = Partial<Omit<ApplicationDraft, "email" | "status" | "submitted_at" | "user_id" | "submission_id">>;

export async function saveDraft(fields: DraftFields): Promise<SaveDraftResult> {
  void fields;
  await new Promise((r) => setTimeout(r, 300));

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
  fields: Omit<Application, "id" | "user_id" | "email" | "status" | "submitted_at" | "created_at" | "updated_at">,
  params: SubmitApplicationParams
): Promise<SubmitApplicationResult> {
  void fields;
  void params;
  await new Promise((r) => setTimeout(r, 500));

  return {
    ok: true,
    applicationId: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };
}

export async function getResumeUploadUrl(): Promise<GetResumeUploadUrlResult> {
  await new Promise((r) => setTimeout(r, 200));

  const path = `resumes/${crypto.randomUUID()}.pdf`;

  return {
    ok: true,
    path,
    signedUrl: `https://example.supabase.co/storage/v1/object/sign/${path}?token=stub`,
    token: "stub-token",
  };
}

export async function getMyApplication(): Promise<GetMyApplicationResult> {
  await new Promise((r) => setTimeout(r, 200));

  return {
    ok: true,
    application: null,
  };
}
