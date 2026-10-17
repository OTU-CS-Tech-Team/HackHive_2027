import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/supabase/server-client";
import { Scanner } from "./Scanner";

export const metadata: Metadata = { title: "Scanner | HackHive 2027" };

export default function ScanPage() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-24 pb-16">
      <h1 className="mb-2 text-2xl font-bold">Scan a pass</h1>
      <p className="mb-6 text-neutral-600">Check-in, event points, help desk redemptions, and emergency info.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <ScanContent />
      </Suspense>
    </main>
  );
}

async function ScanContent() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!admin) redirect("/");

  const [{ data: events }, { data: items }] = await Promise.all([
    supabase.from("events").select("id, title, points").gt("points", 0).order("starts_at"),
    supabase.from("shop_items").select("id, name, cost, stock").eq("active", true).order("sort_order"),
  ]);

  return <Scanner events={events ?? []} items={items ?? []} />;
}
