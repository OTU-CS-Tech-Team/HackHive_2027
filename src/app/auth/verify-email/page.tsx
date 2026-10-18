import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, isVerifiedUser } from "@/lib/auth/helpers";

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

async function VerifyEmailContent() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (isVerifiedUser(user)) {
    redirect("/apply");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-neutral-600">
          We sent a verification link to <strong>{user.email}</strong>. Please check your inbox and
          click the link to continue.
        </p>
        <p className="text-sm text-neutral-500">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <Link href="/signup" className="text-neutral-900 underline hover:no-underline">
            request a new link
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
