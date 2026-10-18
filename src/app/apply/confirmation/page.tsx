import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-10 w-10 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold">Application Submitted!</h1>

        <p className="text-neutral-600">
          Thank you for applying to HackHive 2027. We&apos;ve received your application and will
          review it soon.
        </p>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left">
          <h2 className="font-semibold text-neutral-900">What&apos;s next?</h2>
          <ul className="mt-2 space-y-2 text-sm text-neutral-600">
            <li className="flex gap-2">
              <span className="text-neutral-400">1.</span>
              We&apos;ll review your application within 2 weeks
            </li>
            <li className="flex gap-2">
              <span className="text-neutral-400">2.</span>
              You&apos;ll receive an email with our decision
            </li>
            <li className="flex gap-2">
              <span className="text-neutral-400">3.</span>
              If accepted, you&apos;ll need to confirm your attendance
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Link
            href="/apply/status"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            View My Application
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-6 py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
