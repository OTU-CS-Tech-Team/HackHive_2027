import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadRequestHistory } from "../actions";
import { REQUEST_COLUMNS } from "./query";
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

  // History comes a page at a time (the rest loads from the page), through the same
  // action the "Load more" button uses.
  const [{ data: requests, error }, history] = await Promise.all([
    supabase.from("item_requests").select(REQUEST_COLUMNS).eq("status", "pending").order("queue_number"),
    loadRequestHistory(null),
  ]);
  if (error || !history.ok) {
    return <p className="text-red-700">Could not load requests: {error ? error.message : !history.ok && history.message}</p>;
  }

  return (
    <div className="flex flex-col gap-12">
      <RequestQueue requests={(requests ?? []) as unknown as ItemRequest[]} />
      <RequestHistory firstPage={history.requests} firstPageHasMore={history.hasMore} />
    </div>
  );
}
