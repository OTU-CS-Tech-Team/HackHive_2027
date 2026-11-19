import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import { TABLES, type TableName } from "./tables";

const card = "rounded-lg border border-neutral-200 p-5";

export const metadata: Metadata = { title: "Admin | HackHive 2027" };

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-4xl mt-6">
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
  // Counted in the database: loading rows would stop at Supabase's 1000-row cap.
  const countApps = () => supabase.from("applications").select("*", { count: "exact", head: true });
  const [{ count: accounts }, submittedQ, draftsQ, pendingQ, acceptedQ, waitlistedQ, rejectedQ, pointsQ, { count: events }, ...counts] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    countApps().eq("status", "submitted"),
    countApps().eq("status", "draft"),
    countApps().eq("status", "submitted").is("decision", null),
    countApps().eq("decision", "accepted"),
    countApps().eq("decision", "waitlisted"),
    countApps().eq("decision", "rejected"),
    // Summed in the database too, for the same reason.
    supabase.rpc("admin_points_total"),
    supabase.from("events").select("*", { count: "exact", head: true }),
    ...tables.map((table) => supabase.from(table).select("*", { count: "exact", head: true })),
  ]);
  const appCounts = [submittedQ, draftsQ, pendingQ, acceptedQ, waitlistedQ, rejectedQ];
  // Shown as a dash rather than a misleading 0.
  const points = pointsQ.error || pointsQ.data === null ? "—" : Number(pointsQ.data);
  // A failed count would otherwise read as 0, which looks like "no applicants".
  if (appCounts.some((q) => q.error || q.count === null)) {
    return (
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold">Applicant counts couldn&apos;t be loaded</h2>
        <p className="mt-1 text-sm">Refresh to try again.</p>
      </div>
    );
  }
  const [submitted, drafts, pending, accepted, waitlisted, rejected] = appCounts.map((q) => q.count ?? 0);
  const applicants = [
    ["Applied", pending, "applied"],
    ["Accepted", accepted, "accepted"],
    ["Waitlisted", waitlisted, "waitlisted"],
    ["Rejected", rejected, "rejected"],
  ] as const;
  const stats = [
    ["Accounts", accounts ?? 0],
    ["Applications submitted", submitted],
    ["Drafts", drafts],
    ["Points held by hackers", points],
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
