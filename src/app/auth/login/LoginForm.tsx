"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { OAuthButtons, OrDivider } from "@/components/auth/OAuthButtons";

interface LoginFormProps {
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }
    // Full page load: the session cookie was just set in the browser, and a
    // client navigation can keep serving the signed-out navbar from cache.
    window.location.assign(next);
  };

  // Fallback for forgotten passwords and accounts made back when sign-in was
  // magic-link only (those have no password). Never creates an account.
  const handleEmailLink = async () => {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
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

  if (emailSent) {
    return (
      <main className="min-h-screen px-4 pt-24 pb-8">
        <div className="mx-auto w-full max-w-md space-y-6 text-center">
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
    <main className="min-h-screen px-4 pt-24 pb-8">
      <div className="mx-auto w-full max-w-md space-y-6">
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
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
            {isLoading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-sm text-neutral-600">
            Forgot your password or never set one?{" "}
            <button
              type="button"
              onClick={handleEmailLink}
              disabled={isLoading}
              className="text-neutral-900 underline hover:no-underline disabled:opacity-50"
            >
              Email me a sign-in link
            </button>
            . New here?{" "}
            <Link href="/signup" className="text-neutral-900 underline hover:no-underline">
              Create an account
            </Link>
          </p>
        </form>

        <OrDivider />

        <OAuthButtons redirectPath={next} />
      </div>
    </main>
  );
}
