import { getEvents } from "@/lib/content";
import { Schedule } from "@/components/sections/Schedule";

export async function ScheduleSection() {
  return (
    <section id="schedule" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-16">
      <h2 className="mb-2 text-3xl font-bold">Schedule</h2>
      <p className="mb-6 text-neutral-600">Times are Eastern. Room changes show up here live.</p>
      <Schedule initialEvents={await getEvents()} />
    </section>
  );
}
