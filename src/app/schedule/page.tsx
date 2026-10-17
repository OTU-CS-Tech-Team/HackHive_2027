import type { Metadata } from "next";
import { getEvents } from "@/lib/content";
import { Schedule } from "./Schedule";

export const metadata: Metadata = { title: "Schedule | HackHive 2027" };

export default async function SchedulePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-24 pb-16">
      <h1 className="mb-2 text-3xl font-bold">Schedule</h1>
      <p className="mb-6 text-neutral-600">Times are Eastern. Room changes show up here live.</p>
      <Schedule initialEvents={await getEvents()} />
    </main>
  );
}
