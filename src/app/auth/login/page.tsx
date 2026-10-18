"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { isValidRedirectPath } from "@/lib/application/form-utils";
import { OAuthButtons, OrDivider } from "@/components/auth/OAuthButtons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  
  const next = useMemo(() => {
    const nextParam = searchParams.get("next");
    if (nextParam && isValidRedirectPath(nextParam)) {
      return nextParam;
    }
    return "/apply";
  }, [searchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email_confirmed_at) {
        router.push(next);
      } else {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, [router, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (signInError) {
        throw signInError;
      }

      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send login link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-16">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (emailSent) {
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
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-neutral-600">
            We sent a login link to <strong>{email}</strong>. Click the link to sign in.
          </p>
          <p className="text-sm text-neutral-500">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <button
              type="button"
              onClick={() => setEmailSent(false)}
              className="text-neutral-900 underline hover:no-underline"
            >
              try again
            </button>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in to HackHive 2027</h1>
          <p className="mt-2 text-neutral-600">
            Sign in to continue your application.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Continue with email"}
          </button>

          <p className="text-center text-sm text-neutral-600">
            A magic link will be sent to your email to sign in.
          </p>
        </form>

        <OrDivider />

        <OAuthButtons redirectPath={next} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center pt-16">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
