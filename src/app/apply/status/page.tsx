import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getVerifiedUser } from "@/lib/auth/helpers";
import { getMyApplication } from "@/lib/application/api";
import { ApplicationNextSteps, ApplicationView } from "@/components/ApplicationView";

function LoadingSpinner() {
  return (
    <main className="flex min-h-screen items-center justify-center pt-16">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="mt-4 text-neutral-600">Loading your application...</p>
      </div>
    </main>
  );
}

async function StatusPageContent() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect("/auth/login?next=/apply/status");
  }

  const result = await getMyApplication();

  if (!result.ok) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">Error Loading Application</h1>
          <p className="text-neutral-600">{result.error}</p>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Go to Application
          </Link>
        </div>
      </main>
    );
  }

  if (!result.application) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">No Application Found</h1>
          <p className="text-neutral-600">
            You haven&apos;t started an application yet. Get started now!
          </p>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Start Application
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Application</h1>
          <p className="mt-2 text-neutral-600">
            Review your application details below.
          </p>
        </div>
        <ApplicationNextSteps application={result.application} />
        <ApplicationView application={result.application} />
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-neutral-600 underline hover:text-neutral-900"
          >
            Return to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StatusPageContent />
    </Suspense>
  );
}
