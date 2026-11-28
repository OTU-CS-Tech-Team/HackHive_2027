// Level of study, using MLH's registration options (labels and order exactly as
// MLH lists them). The stored value is a stable slug; show `levelOfStudyLabel`.
export const LEVEL_OF_STUDY_OPTIONS = [
  { value: "less_than_secondary", label: "Less than Secondary / High School" },
  { value: "secondary", label: "Secondary / High School" },
  { value: "undergrad_2_year", label: "Undergraduate University (2 year - community college or similar)" },
  { value: "undergrad_3_plus_year", label: "Undergraduate University (3+ year)" },
  { value: "graduate", label: "Graduate University (Masters, Professional, Doctoral, etc)" },
  { value: "bootcamp", label: "Code School / Bootcamp" },
  { value: "vocational", label: "Other Vocational / Trade Program or Apprenticeship" },
  { value: "post_doctorate", label: "Post Doctorate" },
  { value: "other", label: "Other" },
  { value: "not_a_student", label: "I'm not currently a student" },
  { value: "prefer_not_to_answer", label: "Prefer not to answer" },
] as const;

export type LevelOfStudy = (typeof LEVEL_OF_STUDY_OPTIONS)[number]["value"];

export const LEVEL_OF_STUDY_VALUES = LEVEL_OF_STUDY_OPTIONS.map((o) => o.value) as [LevelOfStudy, ...LevelOfStudy[]];

const LABELS: Record<string, string> = Object.fromEntries(LEVEL_OF_STUDY_OPTIONS.map((o) => [o.value, o.label]));

/** The MLH label for a stored level; unknown values are shown as stored, missing ones as null. */
export function levelOfStudyLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return LABELS[value] ?? value;
}

/** Year of study is only asked (and only required) for the two undergraduate levels. */
export function isUndergradLevel(value: string | null | undefined): boolean {
  return value === "undergrad_2_year" || value === "undergrad_3_plus_year";
}

/** Expected graduation is asked of everyone except people who aren't currently students. */
export function asksGradDate(value: string | null | undefined): boolean {
  return value !== "not_a_student";
}

// year_of_study: "1".."5" (5 = 5th year+). "6" (Graduate) is no longer offered,
// since level of study covers it, but older applications may still hold it.
export const YEAR_OF_STUDY_OPTIONS = [
  { value: "1", label: "1st year" },
  { value: "2", label: "2nd year" },
  { value: "3", label: "3rd year" },
  { value: "4", label: "4th year" },
  { value: "5", label: "5th year+" },
] as const;

const YEAR_LABELS: Record<string, string> = {
  ...Object.fromEntries(YEAR_OF_STUDY_OPTIONS.map((o) => [o.value, o.label])),
  "6": "Graduate",
};

/** Label for a stored year of study; free text from old applications is shown as stored. */
export function yearOfStudyLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return YEAR_LABELS[value] ?? value;
}
