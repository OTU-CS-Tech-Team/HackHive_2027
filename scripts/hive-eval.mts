// Compares the Hive Mind with answers execs scored by hand, before launch and
// after any prompt change.
//
//   npx tsx --env-file=.env.local scripts/hive-eval.mts [file.json]
//
// Defaults to scripts/hive-eval.local.json (gitignored: real answers stay off
// GitHub). See scripts/hive-eval.example.json for the format. Use answers
// people agreed to share, or made-up ones; no names or contact details needed.

import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createOpenAIGrader, hiveModel } from "../src/lib/hive/grader";
import { HiveGradeSchema, PROMPT_VERSION } from "../src/lib/hive/prompt";
import { experienceScore, suggestTier, TIERS } from "../src/lib/hive/tier";

const CHECKS = ["built_it", "shipped", "impact", "beyond_tutorial"] as const;
const rating = z.number().int().min(1).max(5);

const Case = z.object({
  id: z.string(),
  proud: z.string(),
  hack: z.string(),
  anything_else: z.string().default(""),
  hackathons: z.number().int().min(0).default(0),
  expected: z.object({
    built_it: z.boolean(),
    shipped: z.boolean(),
    impact: z.boolean(),
    beyond_tutorial: z.boolean(),
    creativity: rating.optional(),
    quality: rating.optional(),
    tier: z.enum(TIERS).optional(),
  }),
});

const file = process.argv[2] ?? "scripts/hive-eval.local.json";
const cases = z.array(Case).parse(JSON.parse(await readFile(file, "utf8")));
const grade = createOpenAIGrader();

console.log(`Grading ${cases.length} answers with ${hiveModel()} (prompt v${PROMPT_VERSION})…\n`);

const agree: Record<string, number> = { built_it: 0, shipped: 0, impact: 0, beyond_tutorial: 0, tier: 0 };
const ratingGap = { creativity: [] as number[], quality: [] as number[] };
const misses: string[] = [];
let failed = 0;

for (const c of cases) {
  try {
    const got = HiveGradeSchema.parse(JSON.parse(await grade({ proud: c.proud, hack: c.hack, anything_else: c.anything_else })));
    const experience = experienceScore({ builtIt: got.built_it, shipped: got.shipped, impact: got.impact, beyondTutorial: got.beyond_tutorial });
    const tier = suggestTier(experience, c.hackathons);
    const expectedTier =
      c.expected.tier ??
      suggestTier(
        experienceScore({ builtIt: c.expected.built_it, shipped: c.expected.shipped, impact: c.expected.impact, beyondTutorial: c.expected.beyond_tutorial }),
        c.hackathons,
      );

    const wrong: string[] = [];
    for (const check of CHECKS) {
      if (got[check] === c.expected[check]) agree[check]++;
      else wrong.push(`${check} AI=${got[check]} human=${c.expected[check]}`);
    }
    if (tier === expectedTier) agree.tier++;
    else wrong.push(`tier AI=${tier} human=${expectedTier}`);
    for (const key of ["creativity", "quality"] as const) {
      const expected = c.expected[key];
      if (expected) ratingGap[key].push(Math.abs(got[key] - expected));
    }
    if (wrong.length) misses.push(`  ${c.id}: ${wrong.join(", ")}\n    AI: ${got.rationale}`);
    process.stdout.write(wrong.length ? "x" : ".");
  } catch (error) {
    failed++;
    process.stdout.write("!");
    misses.push(`  ${c.id}: failed (${error instanceof Error ? error.message : error})`);
  }
}

const graded = cases.length - failed;
const pct = (n: number) => (graded ? `${Math.round((n / graded) * 100)}%` : "n/a");
const mean = (values: number[]) => (values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : "n/a");

console.log(`\n\nAgreement with humans (${graded} graded, ${failed} failed):`);
for (const key of [...CHECKS, "tier"]) console.log(`  ${key.padEnd(16)} ${pct(agree[key])}`);
console.log(`  creativity       avg gap ${mean(ratingGap.creativity)} (of ${ratingGap.creativity.length})`);
console.log(`  quality          avg gap ${mean(ratingGap.quality)} (of ${ratingGap.quality.length})`);
if (misses.length) console.log(`\nDisagreements:\n${misses.join("\n")}`);
