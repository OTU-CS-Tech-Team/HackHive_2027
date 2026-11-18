import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Scanner } from "./Scanner";

export const metadata: Metadata = { title: "Scanner | HackHive 2027" };

export default function ScanPage() {
  return (
    <main className="w-full px-3 sm:px-4">
      <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">Scan a pass</h1>
      <p className="mb-3 text-sm text-neutral-600">Event points and attendee info.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <ScanContent />
      </Suspense>
    </main>
  );
}

async function ScanContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!admin) redirect("/");

  const [{ data: events }, { data: items }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, category, starts_at, ends_at, points")
      .gt("points", 0)
      .order("starts_at"),
    supabase.from("shop_items").select("id, name, cost, stock").eq("active", true).order("sort_order"),
  ]);

  return <Scanner events={events ?? []} items={items ?? []} />;
}