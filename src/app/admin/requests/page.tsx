import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { RequestQueue, type ItemRequest } from "./RequestQueue";

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

  // item_requests has two links to profiles (requester and reviewer), so name the one we want.
  const { data: requests, error } = await supabase
    .from("item_requests")
    .select("id, queue_number, items, team_members, details, created_at, requester:profiles!user_id(full_name, email)")
    .eq("status", "pending")
    .order("queue_number");
  if (error) return <p className="text-red-700">Could not load requests: {error.message}</p>;

  return <RequestQueue requests={(requests ?? []) as unknown as ItemRequest[]} />;
}
