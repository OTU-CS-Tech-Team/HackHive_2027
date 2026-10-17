"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/supabase/browser-client";

type Mode = "signin" | "signup" | "reset";

const HEADINGS: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create an account",
  reset: "Reset password",
};

const callbackUrl = () => `${window.location.origin}/auth/callback?next=/dashboard`;

export function LoginButtons({ initialError }: { initialError?: string }) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setStatus("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login/reset`,
      });
      setLoading(false);
      // Same message whether or not the account exists, so the form doesn't leak who's signed up.
      if (error) setError(error.message);
      else setStatus("If that email has an account, a reset link is on its way. Open it in this browser.");
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      setLoading(false);
      if (error) return setError(error.message);
      // Existing email: Supabase fakes a success (no identities) and does NOT set the password.
      if (data.user?.identities?.length === 0) {
        setMode("signin");
        return setError("That email already has an account. Sign in, or use “Forgot password?” to set a password.");
      }
      // With email confirmation off, Supabase signs them straight in.
      if (data.session) return router.push("/dashboard");
      setStatus("Check your inbox to confirm your account, then sign in.");
      setMode("signin");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    // On success the browser leaves for Google.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  const button = "w-full rounded border px-4 py-2 disabled:opacity-50";
  const input = "w-full rounded border px-3 py-2";

  return (
    <div className="flex flex-col gap-3">
      <h1 className="mb-3 text-2xl font-bold">{HEADINGS[mode]}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          autoComplete="email"
          className={input}
        />
        {mode !== "reset" && (
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={input}
          />
        )}
        {mode === "signin" && (
          <button type="button" className="self-end text-sm underline" onClick={() => switchMode("reset")}>
            Forgot password?
          </button>
        )}
        <button className={`${button} bg-neutral-900 text-white`} disabled={loading}>
          {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
        </button>
      </form>

      {mode !== "reset" && (
        <>
          <p className="text-center text-sm text-neutral-500">or</p>
          <button type="button" className={button} onClick={handleGoogle} disabled={loading}>
            Continue with Google
          </button>
        </>
      )}

      <button
        type="button"
        className="text-sm underline"
        onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "New here? Create an account" : mode === "reset" ? "Back to sign in" : "Already have an account? Sign in"}
      </button>

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-emerald-700">
          {status}
        </p>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded border px-4 py-2"
      onClick={async () => {
        await getSupabaseBrowserClient().auth.signOut();
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
