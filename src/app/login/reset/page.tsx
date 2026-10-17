"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/supabase/browser-client";

const EXPIRED =
  "This reset link has expired or was already used. Request a new one, and open it in the same browser you requested it from.";

// The reset email links here. Supabase adds ?code= (default template; the
// browser client signs in with it on load), ?token_hash= (custom template;
// verified on submit so email link scanners can't use up the one-time token).
// A dead link leaves no session, so submitting shows the expired message.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
      if (error) {
        setLoading(false);
        setExpired(true);
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      if (error.name === "AuthSessionMissingError") setExpired(true);
      else setStatus(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto max-w-sm px-4 pt-24">
      <h1 className="mb-6 text-2xl font-bold">Set a new password</h1>
      {expired ? (
        <>
          <p role="alert" className="mb-4 text-red-600">
            {EXPIRED}
          </p>
          <Link href="/login" className="underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            aria-label="New password"
            autoComplete="new-password"
            className="w-full rounded border px-3 py-2"
          />
          <button className="w-full rounded border bg-neutral-900 px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
            Save password
          </button>
          {status && (
            <p role="alert" className="text-red-600">
              {status}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
