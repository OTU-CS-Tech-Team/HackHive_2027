"use client";

import { useSyncExternalStore } from "react";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/apply/ApplyForm";

type AuthState = { verified: boolean; email: string | null };

const SERVER_SNAPSHOT: AuthState = { verified: false, email: null };

let cachedClientSnapshot: AuthState | null = null;

function getAuthSnapshot(): AuthState {
  if (typeof window === "undefined") {
    return SERVER_SNAPSHOT;
  }
  if (cachedClientSnapshot === null) {
    cachedClientSnapshot = {
      verified: localStorage.getItem("hackhive_verified") === "true",
      email: localStorage.getItem("hackhive_user_email"),
    };
  }
  return cachedClientSnapshot;
}

function getServerSnapshot(): AuthState {
  return SERVER_SNAPSHOT;
}

function subscribeToAuth(callback: () => void): () => void {
  const handler = () => {
    cachedClientSnapshot = {
      verified: localStorage.getItem("hackhive_verified") === "true",
      email: localStorage.getItem("hackhive_user_email"),
    };
    callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export default function ApplyPage() {
  const auth = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerSnapshot);

  if (!auth.verified || !auth.email) {
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
        <ApplyForm userEmail={auth.email} />
      </div>
    </main>
  );
}
