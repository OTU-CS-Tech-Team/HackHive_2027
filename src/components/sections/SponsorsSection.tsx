/* eslint-disable @next/next/no-img-element -- logos come from Supabase Storage */
import { getSponsors, type Sponsor } from "@/lib/content";

// TODO: real sponsorship inbox.
const SPONSOR_CONTACT = "mailto:sponsors@example.com?subject=Sponsoring%20HackHive%202027";

const TIERS: { tier: Sponsor["tier"]; label: string; logo: string }[] = [
  { tier: "gold", label: "Gold", logo: "h-28" },
  { tier: "silver", label: "Silver", logo: "h-20" },
  { tier: "bronze", label: "Bronze", logo: "h-14" },
];

export async function SponsorsSection() {
  const sponsors = await getSponsors();

  return (
    <section id="sponsors" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="mb-2 text-3xl font-bold">Sponsors</h2>
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
          <div key={tier} className="mb-12">
            <h3 className="mb-4 text-xl font-semibold">{label}</h3>
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
          </div>
        );
      })}

      {!sponsors.length && <p className="text-neutral-600">Sponsors will be announced soon.</p>}
    </section>
  );
}
