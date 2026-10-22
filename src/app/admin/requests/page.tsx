import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { RequestHistory, RequestQueue, type ItemRequest } from "./RequestQueue";

export const metadata: Metadata = { title: "Item requests | HackHive 2027" };

export default function RequestsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-24 pb-16">
      <header className="mb-6">
        <Link href="/admin" className="text-sm underline">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Item requests</h1>
        <p className="text-neutral-600">First come, first served: review the top request before moving on.</p>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <RequestsContent />
      </Suspense>
    </main>
  );
}

async function RequestsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!admin) redirect("/");

  // item_requests has two links to profiles (requester and reviewer), so each join names its column.
  const columns =
    "id, queue_number, items, team_members, details, created_at, status, reviewed_at, admin_note, requester:profiles!user_id(full_name, email), reviewer:profiles!reviewed_by(full_name, email)";
  const [{ data: requests, error }, { data: history, error: historyError }] = await Promise.all([
    supabase.from("item_requests").select(columns).eq("status", "pending").order("queue_number"),
    supabase.from("item_requests").select(columns).neq("status", "pending").order("reviewed_at", { ascending: false }),
  ]);
  if (error || historyError) {
    return <p className="text-red-700">Could not load requests: {(error ?? historyError)!.message}</p>;
  }

  return (
    <div className="flex flex-col gap-12">
      <RequestQueue requests={(requests ?? []) as unknown as ItemRequest[]} />
      <RequestHistory requests={(history ?? []) as unknown as ItemRequest[]} />
    </div>
  );
}
