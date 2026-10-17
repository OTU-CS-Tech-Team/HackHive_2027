"use client";

import { useMemo } from "react";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/apply/ApplyForm";

function getAuthState(): { verified: boolean; email: string | null } {
  if (typeof window === "undefined") {
    return { verified: false, email: null };
  }
  const verified = localStorage.getItem("hackhive_verified") === "true";
  const email = localStorage.getItem("hackhive_user_email");
  return { verified, email };
}

export default function ApplyPage() {
  const authState = useMemo(() => getAuthState(), []);

  if (!authState.verified || !authState.email) {
    if (typeof window !== "undefined") {
      redirect("/signup");
    }
    return (
      <main className="flex min-h-screen items-center justify-center pt-16">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Apply to HackHive 2027</h1>
          <p className="mt-2 text-neutral-600">
            Fill out the form below to apply. Your progress is saved automatically.
          </p>
        </div>
        <ApplyForm userEmail={authState.email} />
      </div>
    </main>
  );
}
