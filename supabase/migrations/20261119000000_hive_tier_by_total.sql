-- Hive Mind tiers now come from the total out of 15 (experience + creativity +
-- quality), not the first rule's "experience or hackathon count": a self-reported
-- 5+ hackathons put people scoring 1/5 on everything in Queen Bee.
--   Queen Bee 12-15 · Worker Bee 8-11 · Larva 3-7
-- Same cutoffs as TIER_CUTOFFS in src/lib/hive/tier.ts; new scores use that.
--
-- Recomputes the suggested tier from the scores already saved, so nobody is
-- re-graded (no AI cost). Admin overrides are kept: the shown tier is still the
-- override wherever one exists, and the override log isn't touched.
--
-- Safe to run more than once.

begin;

update public.hive_scores
set
  suggested_tier = case
    when experience + creativity + quality >= 12 then 'queen'
    when experience + creativity + quality >= 8 then 'worker'
    else 'larva'
  end,
  updated_at = now()
where status = 'scored'
  and experience is not null and creativity is not null and quality is not null;

commit;
