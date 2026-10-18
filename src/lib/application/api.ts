export {
  saveDraft,
  submitApplication,
  getResumeUploadUrl,
  getMyApplication,
} from "@/app/actions/applications";

export type { ErrorCode } from "@/lib/application/schema";

export const ERROR_MESSAGES: Record<string, string> = {
  validation: "Please fix the errors in the form and try again.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  turnstile: "Security verification failed. Please refresh the captcha and try again.",
  too_fast: "Please take more time to fill out the form before submitting.",
  locked: "Applications are now closed. The deadline has passed.",
  already_submitted: "You have already submitted your application.",
  not_verified: "Please verify your email before submitting.",
  server: "Something went wrong. Please try again later.",
};
