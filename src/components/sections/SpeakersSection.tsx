/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage */
import { getPeople, type Person } from "@/lib/content";

const GROUPS: { role: Person["role"]; heading: string; blurb: string }[] = [
  { role: "speaker", heading: "Keynote speakers", blurb: "The people opening and closing the weekend." },
  { role: "judge", heading: "Judges", blurb: "They score every project at demo time." },
];

export async function SpeakersSection() {
  const people = await getPeople();

  return (
    <section id="speakers" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16">
      <h2 className="mb-10 text-3xl font-bold">Speakers & Judges</h2>

      {GROUPS.map(({ role, heading, blurb }) => {
        const group = people.filter((person) => person.role === role);
        return (
          <div key={role} className="mb-14">
            <h3 className="text-xl font-semibold">{heading}</h3>
            <p className="mb-6 text-neutral-600">{blurb}</p>
            {group.length ? (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((person) => (
                  <li key={person.id} className="rounded-lg border border-neutral-200 p-5">
                    {person.photo_url ? (
                      <img src={person.photo_url} alt="" className="mb-4 size-24 rounded-full object-cover" />
                    ) : (
                      <span className="mb-4 block size-24 rounded-full bg-neutral-200" aria-hidden />
                    )}
                    <h4 className="font-semibold">{person.name}</h4>
                    {(person.title || person.company) && (
                      <p className="text-sm text-neutral-600">
                        {[person.title, person.company].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {person.bio && <p className="mt-3 text-sm">{person.bio}</p>}
                    {person.linkedin_url && (
                      <a href={person.linkedin_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline">
                        LinkedIn
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-600">Announcing soon.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
