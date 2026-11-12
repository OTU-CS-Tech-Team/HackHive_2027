import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { applicantStatus } from "@/components/ApplicationView";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { Application } from "@/lib/application/schema";
import { TABLES, type TableName } from "./tables";

const card = "rounded-lg border border-neutral-200 p-5";

export const metadata: Metadata = { title: "Admin | HackHive 2027" };

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-neutral-600">Everything else is in the sidebar.</p>
      </header>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  const supabase = await requireAdmin();

  const tables = Object.keys(TABLES) as TableName[];
  const [{ count: accounts }, { data: applications }, { data: balances }, { count: events }, ...counts] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("status, decision, submitted_at"),
    // ponytail: sums every balance row in JS; move to a SQL view if hackers number in the tens of thousands.
    supabase.from("point_balances").select("balance"),
    supabase.from("events").select("*", { count: "exact", head: true }),
    ...tables.map((table) => supabase.from(table).select("*", { count: "exact", head: true })),
  ]);
  const apps = (applications ?? []) as Application[];
  const submitted = apps.filter((app) => app.status === "submitted").length;
  const count = (status: ReturnType<typeof applicantStatus>) => apps.filter((app) => applicantStatus(app) === status).length;
  const applicants = [
    ["Applied", count("applied"), "applied"],
    ["Accepted", count("accepted"), "accepted"],
    ["Waitlisted", count("waitlisted"), "waitlisted"],
    ["Rejected", count("rejected"), "rejected"],
  ] as const;
  const stats = [
    ["Accounts", accounts ?? 0],
    ["Applications submitted", submitted],
    ["Drafts", apps.length - submitted],
    ["Points held by hackers", (balances ?? []).reduce((sum, row) => sum + row.balance, 0)],
  ] as const;
  const content = [
    ["/admin/schedule", "Schedule", events ?? 0],
    ...tables.map((table, i) => [`/admin/${table}`, TABLES[table].heading, counts[i].count ?? 0] as const),
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className="mb-1 text-lg font-semibold">Applicant status</h2>
        <p className="mb-4 text-sm text-neutral-600">Applied = submitted, no decision yet. Only accepted hackers get the hacker hub.</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {applicants.map(([label, value, status]) => (
            <li key={label}>
              <Link href={`/admin/applicants?status=${status}`} className="block rounded-md border border-neutral-200 p-3 transition-colors hover:border-neutral-900">
                <span className="block text-sm text-neutral-600">{label}</span>
                <span className="text-3xl font-bold tabular-nums">{value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="mb-4 text-lg font-semibold">Stats</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-neutral-600">{label}</dt>
              <dd className="text-3xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={card}>
        <h2 className="mb-4 text-lg font-semibold">Site content</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {content.map(([href, label, value]) => (
            <li key={href}>
              <Link href={href} className="block rounded-md border border-neutral-200 p-3 transition-colors hover:border-neutral-900">
                <span className="block text-sm text-neutral-600">{label}</span>
                <span className="text-2xl font-bold tabular-nums">{value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
