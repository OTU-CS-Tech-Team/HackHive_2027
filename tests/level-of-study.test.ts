import { describe, expect, it } from 'vitest';
import {
  LEVEL_OF_STUDY_OPTIONS,
  isUndergradLevel,
  levelOfStudyLabel,
  yearOfStudyLabel,
} from '@/lib/application/level-of-study';
import { applicationDraftSchema, applicationSubmitSchema } from '@/lib/application/schema';
import { buildDraftPayload, initialFormData, yearOfStudyToSave } from '@/lib/application/draft-payload';

const submission = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone: '4165550100',
  age: 21,
  city: 'Toronto',
  country: 'Canada',
  university: 'University of Toronto',
  program: 'CS',
  level_of_study: 'undergrad_3_plus_year',
  year_of_study: '3',
  resume_path: 'user/resume.pdf',
  q_proud: 'a',
  q_hack: 'b',
  team_status: 'solo',
  tshirt_size: 'M',
  gender: 'prefer-not-to-say',
  ethnicity: 'prefer-not-to-say',
  consent_coc: true,
  consent_privacy: true,
  consent_indemnification: true,
  consent_esignature: true,
  consent_mlh_coc: true,
  consent_mlh_share: true,
};

const issuesFor = (data: Record<string, unknown>) => {
  const result = applicationSubmitSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
};

describe('level of study options', () => {
  it("uses MLH's labels, in MLH's order", () => {
    expect(LEVEL_OF_STUDY_OPTIONS.map((o) => o.label)).toEqual([
      'Less than Secondary / High School',
      'Secondary / High School',
      'Undergraduate University (2 year - community college or similar)',
      'Undergraduate University (3+ year)',
      'Graduate University (Masters, Professional, Doctoral, etc)',
      'Code School / Bootcamp',
      'Other Vocational / Trade Program or Apprenticeship',
      'Post Doctorate',
      'Other',
      "I'm not currently a student",
      'Prefer not to answer',
    ]);
  });

  it('has unique values that fit the column', () => {
    const values = LEVEL_OF_STUDY_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value.length).toBeLessThanOrEqual(50);
  });

  it('only treats the two undergraduate levels as undergrad', () => {
    expect(LEVEL_OF_STUDY_OPTIONS.filter((o) => isUndergradLevel(o.value)).map((o) => o.label)).toEqual([
      'Undergraduate University (2 year - community college or similar)',
      'Undergraduate University (3+ year)',
    ]);
    expect(isUndergradLevel(null)).toBe(false);
    expect(isUndergradLevel('')).toBe(false);
  });

  it('labels stored values, and copes with old applications', () => {
    expect(levelOfStudyLabel('graduate')).toBe('Graduate University (Masters, Professional, Doctoral, etc)');
    expect(levelOfStudyLabel(null)).toBeNull();
    expect(levelOfStudyLabel('')).toBeNull();
    expect(yearOfStudyLabel('2')).toBe('2nd year');
    expect(yearOfStudyLabel('6')).toBe('Graduate');
    expect(yearOfStudyLabel('Junior')).toBe('Junior');
    expect(yearOfStudyLabel(null)).toBeNull();
  });
});

describe('submit validation', () => {
  it('accepts an undergrad with a year', () => {
    const result = applicationSubmitSchema.safeParse(submission);
    expect(result.success).toBe(true);
    expect(result.data?.level_of_study).toBe('undergrad_3_plus_year');
    expect(result.data?.year_of_study).toBe('3');
  });

  it('requires a level of study', () => {
    expect(issuesFor({ ...submission, level_of_study: undefined })).toContain('level_of_study');
    expect(issuesFor({ ...submission, level_of_study: '' })).toContain('level_of_study');
    expect(issuesFor({ ...submission, level_of_study: 'Undergraduate' })).toContain('level_of_study');
  });

  it('requires a year for both undergraduate levels', () => {
    for (const level of ['undergrad_2_year', 'undergrad_3_plus_year']) {
      expect(issuesFor({ ...submission, level_of_study: level, year_of_study: '' })).toEqual(['year_of_study']);
      expect(issuesFor({ ...submission, level_of_study: level, year_of_study: null })).toEqual(['year_of_study']);
    }
  });

  it('does not need a year for other levels, and drops one if sent', () => {
    for (const { value } of LEVEL_OF_STUDY_OPTIONS.filter((o) => !isUndergradLevel(o.value))) {
      const withoutYear = applicationSubmitSchema.safeParse({ ...submission, level_of_study: value, year_of_study: '' });
      expect(withoutYear.success, value).toBe(true);
      const withYear = applicationSubmitSchema.safeParse({ ...submission, level_of_study: value, year_of_study: '6' });
      expect(withYear.success, value).toBe(true);
      expect(withYear.data?.year_of_study, value).toBeUndefined();
    }
  });
});

describe('drafts', () => {
  it('saves a level of study, and accepts a blank or missing one', () => {
    expect(applicationDraftSchema.safeParse({ level_of_study: 'bootcamp' }).success).toBe(true);
    expect(applicationDraftSchema.safeParse({ level_of_study: '' }).data?.level_of_study).toBeNull();
    expect(applicationDraftSchema.safeParse({ level_of_study: null }).success).toBe(true);
    expect(applicationDraftSchema.safeParse({}).success).toBe(true);
    expect(applicationDraftSchema.safeParse({ level_of_study: 'nonsense' }).success).toBe(false);
  });

  it('saves the year as null once a non-undergraduate level is picked', () => {
    const payload = (level_of_study: string, year_of_study: string) =>
      buildDraftPayload({ ...initialFormData, level_of_study, year_of_study });
    expect(payload('undergrad_2_year', '1')).toMatchObject({ level_of_study: 'undergrad_2_year', year_of_study: '1' });
    expect(payload('graduate', '3')).toMatchObject({ level_of_study: 'graduate', year_of_study: null });
    // An older draft with a year but no level yet keeps its year.
    expect(payload('', '2')).toMatchObject({ level_of_study: null, year_of_study: '2' });
    expect(yearOfStudyToSave({ level_of_study: 'secondary', year_of_study: '' })).toBeNull();
  });
});
