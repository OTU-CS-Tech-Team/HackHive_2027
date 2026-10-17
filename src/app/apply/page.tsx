import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getVerifiedUser } from "@/lib/auth/helpers";
import { getMyApplication } from "@/lib/application/api";
import { ApplyForm } from "@/components/apply/ApplyForm";

function LoadingSpinner() {
  return (
    <main className="flex min-h-screen items-center justify-center pt-16">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="mt-4 text-neutral-600">Loading...</p>
      </div>
    </main>
  );
}

async function ApplyPageContent() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect("/auth/login?next=/apply");
  }

  const result = await getMyApplication();
  
  if (result.ok && result.application?.status === "submitted") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Application Already Submitted</h1>
          <p className="text-neutral-600">
            You have already submitted your application. You can view your application status below.
          </p>
          <Link
            href="/apply/status"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            View Application Status
          </Link>
        </div>
      </main>
    );
  }

  const initialDraft = result.ok && result.application ? {
    first_name: result.application.first_name || "",
    last_name: result.application.last_name || "",
    phone: result.application.phone || "",
    age: result.application.age?.toString() || "",
    pronouns: result.application.pronouns || "",
    city: result.application.city || "",
    country: result.application.country || "",
    university: result.application.university || "",
    program: result.application.program || "",
    year_of_study: result.application.year_of_study || "",
    grad_date: result.application.grad_date || "",
    hackathons_count: result.application.hackathons_count?.toString() || "0",
    linkedin_url: result.application.linkedin_url || "",
    github_url: result.application.github_url || "",
    portfolio_url: result.application.portfolio_url || "",
    resume_path: result.application.resume_path || null,
    q_proud: result.application.q_proud || "",
    q_hack: result.application.q_hack || "",
    q_anything_else: result.application.q_anything_else || "",
    team_status: result.application.team_status || "",
    teammate_emails: result.application.teammate_emails || [],
    dietary: result.application.dietary || "",
    accessibility: result.application.accessibility || "",
    tshirt_size: result.application.tshirt_size || "",
    needs_travel_help: result.application.needs_travel_help || false,
    gender: result.application.gender || "",
    ethnicity: result.application.ethnicity || "",
    guardian_name: result.application.guardian_name || "",
    guardian_phone: result.application.guardian_phone || "",
    guardian_relationship: result.application.guardian_relationship || "",
    consent_coc: result.application.consent_coc || false,
    consent_privacy: result.application.consent_privacy || false,
    consent_photo: result.application.consent_photo || false,
    share_resume_with_sponsors: result.application.share_resume_with_sponsors || false,
  } : null;

  return (
    <main className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Apply to HackHive 2027</h1>
          <p className="mt-2 text-neutral-600">
            Fill out the form below to apply. Your progress is saved automatically.
          </p>
        </div>
        <ApplyForm userEmail={user.email} initialDraft={initialDraft} />
      </div>
    </main>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ApplyPageContent />
    </Suspense>
  );
}
