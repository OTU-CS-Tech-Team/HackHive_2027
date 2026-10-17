/* eslint-disable @next/next/no-img-element -- logos come from Supabase Storage */
import type { Metadata } from "next";
import { getSponsors, type Sponsor } from "@/lib/content";

export const metadata: Metadata = { title: "Sponsors | HackHive 2027" };

// TODO: real sponsorship inbox.
const SPONSOR_CONTACT = "mailto:sponsors@example.com?subject=Sponsoring%20HackHive%202027";

const TIERS: { tier: Sponsor["tier"]; label: string; logo: string }[] = [
  { tier: "gold", label: "Gold", logo: "h-28" },
  { tier: "silver", label: "Silver", logo: "h-20" },
  { tier: "bronze", label: "Bronze", logo: "h-14" },
];

export default async function SponsorsPage() {
  const sponsors = await getSponsors();

  return (
    <main className="mx-auto max-w-5xl px-4 pt-24 pb-16">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Sponsors</h1>
          <p className="text-neutral-600">HackHive happens because of these teams.</p>
        </div>
        <a href={SPONSOR_CONTACT} className="rounded bg-neutral-900 px-5 py-2.5 font-medium text-white">
          Become a sponsor
        </a>
      </div>

      {TIERS.map(({ tier, label, logo }) => {
        const inTier = sponsors.filter((sponsor) => sponsor.tier === tier);
        if (!inTier.length) return null;
        return (
          <section key={tier} className="mb-12">
            <h2 className="mb-4 text-xl font-semibold">{label}</h2>
            <ul className="flex flex-wrap items-center gap-10">
              {inTier.map((sponsor) => {
                const content = sponsor.logo_url ? (
                  <img src={sponsor.logo_url} alt={sponsor.name} className={`${logo} w-auto object-contain`} />
                ) : (
                  <span className="text-lg font-semibold">{sponsor.name}</span>
                );
                return (
                  <li key={sponsor.id}>
                    {sponsor.website_url ? (
                      <a href={sponsor.website_url} target="_blank" rel="noreferrer">
                        {content}
                      </a>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {!sponsors.length && <p className="text-neutral-600">Sponsors will be announced soon.</p>}
    </main>
  );
}
