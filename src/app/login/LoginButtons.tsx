"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/supabase/browser-client";

const callbackUrl = () => `${window.location.origin}/auth/callback?next=/login`;

export function LoginButtons() {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  const button = "w-full rounded border px-4 py-2";

  return (
    <div className="flex flex-col gap-3">
      <button
        className={button}
        onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } })}
      >
        Continue with Google
      </button>
      <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          className="rounded border px-3 py-2"
        />
        <button className={button}>Email me a sign-in link</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="mt-6 rounded border px-4 py-2"
      onClick={async () => {
        await getSupabaseBrowserClient().auth.signOut();
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
