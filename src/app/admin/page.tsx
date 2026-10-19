import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { HackEvent } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { EventsAdmin } from "./EventsAdmin";
import { TableAdmin } from "./TableAdmin";
import { TABLES, type Row, type TableName } from "./tables";

export const metadata: Metadata = { title: "Admin | HackHive 2027" };

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-24 pb-16">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-neutral-600">Changes show on the site right away.</p>
          <nav className="mt-2 flex flex-wrap gap-x-4 text-sm underline">
            <a href="#events">Schedule</a>
            {Object.entries(TABLES).map(([table, { heading }]) => (
              <a key={table} href={`#${table}`}>
                {heading}
              </a>
            ))}
          </nav>
        </div>
        <Link href="/admin/scan" className="rounded bg-neutral-900 px-4 py-2 text-white">
          Open scanner
        </Link>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!admin) redirect("/");

  const tables = Object.keys(TABLES) as TableName[];
  const [{ data: events }, ...rows] = await Promise.all([
    supabase.from("events").select("*").order("starts_at"),
    ...tables.map((table) => supabase.from(table).select("*").order("sort_order").order("name")),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <EventsAdmin events={(events ?? []) as HackEvent[]} />
      {tables.map((table, i) => (
        <TableAdmin key={table} table={table} rows={(rows[i].data ?? []) as Row[]} />
      ))}
    </div>
  );
}
