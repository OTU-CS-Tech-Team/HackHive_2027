import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ApplicationView } from "@/components/ApplicationView";
import type { Application } from "@/lib/application/schema";
import type { HackEvent } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { EventsAdmin } from "./EventsAdmin";
import { TableAdmin } from "./TableAdmin";
import { TABLES, type Row, type TableName } from "./tables";

const card = "rounded-lg border border-neutral-200 p-5";

export const metadata: Metadata = { title: "Admin | HackHive 2027" };

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-24 pb-16">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-neutral-600">Changes show on the site right away.</p>
          <nav className="mt-2 flex flex-wrap gap-x-4 text-sm underline">
            <a href="#stats">Stats</a>
            <a href="#applications">Applications</a>
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
  const [{ count: accounts }, { data: applications }, { data: balances }, { data: events }, ...rows] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("*").order("submitted_at", { ascending: false, nullsFirst: false }),
    // ponytail: sums every balance row in JS; move to a SQL view if hackers number in the tens of thousands.
    supabase.from("point_balances").select("balance"),
    supabase.from("events").select("*").order("starts_at"),
    ...tables.map((table) => supabase.from(table).select("*").order("sort_order").order("name")),
  ]);
  const apps = (applications ?? []) as Application[];
  const submitted = apps.filter((app) => app.status === "submitted").length;
  const stats = [
    ["Accounts", accounts ?? 0],
    ["Applications submitted", submitted],
    ["Drafts", apps.length - submitted],
    ["Points held by hackers", (balances ?? []).reduce((sum, row) => sum + row.balance, 0)],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <section id="stats" className={`${card} scroll-mt-20`}>
        <h2 className="mb-4 text-lg font-semibold">Stats</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-neutral-600">{label}</dt>
              <dd className="text-3xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="applications" className={`${card} scroll-mt-20`}>
        <h2 className="mb-4 text-lg font-semibold">Applications ({apps.length})</h2>
        <ol className="flex flex-col divide-y">
          {apps.map((app) => (
            <li key={app.id} className="py-3">
              <details>
                <summary className="cursor-pointer">
                  <span className="font-semibold">{[app.first_name, app.last_name].filter(Boolean).join(" ") || app.email}</span>
                  <span className="text-sm text-neutral-600">
                    {" "}
                    · {app.email} · {app.university ?? "No school"} · {app.status}
                  </span>
                </summary>
                <div className="mt-3">
                  <ApplicationView application={app} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
      <EventsAdmin events={(events ?? []) as HackEvent[]} />
      {tables.map((table, i) => (
        <TableAdmin key={table} table={table} rows={(rows[i].data ?? []) as Row[]} />
      ))}
    </div>
  );
}
