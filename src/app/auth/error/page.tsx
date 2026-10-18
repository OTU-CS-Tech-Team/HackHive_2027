"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get("message");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Authentication Error</h1>
        <p className="text-neutral-600">
          {errorMessage || "Something went wrong during authentication. The link may have expired or already been used."}
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Try again
          </Link>
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

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center pt-16">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            <p className="mt-4 text-neutral-600">Loading...</p>
          </div>
        </main>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
