import { describe, expect, it } from 'vitest';
import type { Application } from '@/lib/application/schema';
import { HIVE_INPUT_FIELDS, buildHiveInput } from '@/lib/hive/input';
import { HiveGradeSchema, formatAnswers } from '@/lib/hive/prompt';

// Every field on the form, filled with a value that must never reach the AI.
const full: Application = {
  id: 'app-id', user_id: 'user-id', email: 'ada@example.com', status: 'submitted', decision: null,
  submitted_at: '2026-11-01', created_at: '2026-11-01', updated_at: '2026-11-01',
  first_name: 'Ada', last_name: 'Lovelace', preferred_name: 'Countess', phone: '905-555-0100', age: 16,
  pronouns: 'she/her', city: 'Oshawa', country: 'Canada', university: 'Ontario Tech University',
  program: 'Computer Science', year_of_study: '1', grad_date: '2030-04-01', hackathons_count: 7,
  linkedin_url: 'https://linkedin.com/in/ada', github_url: 'https://github.com/ada', portfolio_url: 'https://ada.dev',
  other_links: ['https://devpost.com/ada'], resume_path: 'user-id/resume.pdf',
  q_proud: '  I built a compiler.  ', q_hack: 'Reused a router.', q_anything_else: 'Need a visa letter.',
  team_status: 'has_team', teammate_emails: ['friend@example.com'], dietary: 'Halal', accessibility: 'Wheelchair',
  tshirt_size: 'XL', needs_travel_help: true, gender: 'Woman', ethnicity: 'Black',
  guardian_name: 'Byron', guardian_phone: '905-555-0199', guardian_relationship: 'Father',
  consent_coc: true, consent_privacy: true, consent_indemnification: true, indemnification_path: 'user-id/form.pdf',
  consent_esignature: true, consent_photo: true, share_resume_with_sponsors: true,
};

describe('buildHiveInput', () => {
  it('keeps only the three short answers, trimmed', () => {
    expect(buildHiveInput(full)).toEqual({ proud: 'I built a compiler.', hack: 'Reused a router.', anything_else: 'Need a visa letter.' });
    expect(HIVE_INPUT_FIELDS).toEqual(['q_proud', 'q_hack', 'q_anything_else']);
  });

  it('never sends identity, school, links, resume, team, demographics or logistics', () => {
    const sent = formatAnswers(buildHiveInput(full));
    const allowed = new Set<string>(HIVE_INPUT_FIELDS);
    for (const [field, value] of Object.entries(full)) {
      if (allowed.has(field) || value === null || typeof value === 'boolean') continue;
      for (const part of Array.isArray(value) ? value : [value]) {
        expect(sent, `${field} leaked`).not.toContain(String(part));
      }
    }
  });

  it('sends empty strings for missing answers', () => {
    expect(buildHiveInput({ q_proud: null, q_hack: null, q_anything_else: null })).toEqual({ proud: '', hack: '', anything_else: '' });
  });
});

describe('HiveGradeSchema', () => {
  const valid = { built_it: true, shipped: false, impact: false, beyond_tutorial: true, creativity: 3, quality: 5, rationale: 'Specific.', flags: [] };

  it('accepts a well-formed grade', () => {
    expect(HiveGradeSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['a rating above 5', { creativity: 6 }],
    ['a rating below 1', { quality: 0 }],
    ['a fractional rating', { quality: 2.5 }],
    ['an unknown flag', { flags: ['rejected'] }],
    ['a missing check', { built_it: undefined }],
  ])('rejects %s', (_, change) => {
    expect(HiveGradeSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});
