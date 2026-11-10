import { getEventCategories, getEvents } from "@/lib/content";
import { Schedule } from "@/components/sections/Schedule";

export async function ScheduleSection() {
  const [events, categories] = await Promise.all([getEvents(), getEventCategories()]);
  return (
    <section id="schedule" className="scroll-mt-16">
      <h2 className="mb-2 text-2xl font-bold">Schedule</h2>
      <p className="mb-6 text-neutral-600">Times are Eastern. Room changes show up here live.</p>
      <Schedule initialEvents={events} initialCategories={categories} />
    </section>
  );
}
