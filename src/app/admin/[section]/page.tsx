import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { EventCategory, HackEvent } from "@/lib/content";
import { EventsAdmin } from "../EventsAdmin";
import { TableAdmin } from "../TableAdmin";
import { TABLES, type Row, type TableName } from "../tables";

// One tab per editable thing: /admin/schedule, /admin/sponsors, ...
// (applicants, requests, scan and stats are their own folders, which win over this one.)

export const metadata: Metadata = { title: "Admin | HackHive 2027" };

const isTable = (section: string): section is TableName => Object.hasOwn(TABLES, section);

export function generateStaticParams() {
  return ["schedule", ...Object.keys(TABLES)].map((section) => ({ section }));
}

type Params = Promise<{ section: string }>;

export default function SectionPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-3xl">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Section params={params} />
      </Suspense>
    </main>
  );
}

function Header({ title, count }: { title: string; count: number }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {title} <span className="text-neutral-400 tabular-nums">{count}</span>
      </h1>
      <p className="mt-1 text-sm text-neutral-600">Changes show on the site right away. Shift-click to select a range.</p>
    </header>
  );
}

async function Section({ params }: { params: Params }) {
  const { section } = await params;
  if (section !== "schedule" && !isTable(section)) notFound();
  const supabase = await requireAdmin(`/admin/${section}`);

  if (section === "schedule") {
    const [{ data: events }, { data: categories }] = await Promise.all([
      supabase.from("events").select("*").order("starts_at"),
      supabase.from("event_categories").select("*").order("sort_order").order("name"),
    ]);
    return (
      <>
        <Header title="Schedule" count={events?.length ?? 0} />
        <EventsAdmin events={(events ?? []) as HackEvent[]} categories={(categories ?? []) as EventCategory[]} />
      </>
    );
  }

  const { data: rows } = await supabase.from(section).select("*").order("sort_order").order("name");
  return (
    <>
      <Header title={TABLES[section].heading} count={rows?.length ?? 0} />
      <TableAdmin table={section} rows={(rows ?? []) as Row[]} />
    </>
  );
}
