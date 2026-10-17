import { z } from "zod";

export const APPLICATION_STATUS = ["draft", "submitted"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];

export const TEAM_STATUS = ["solo", "has_team", "looking"] as const;
export type TeamStatus = (typeof TEAM_STATUS)[number];

export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type TshirtSize = (typeof TSHIRT_SIZES)[number];

export const FIELD_LIMITS = {
  first_name: 100,
  last_name: 100,
  phone: 30,
  pronouns: 50,
  city: 100,
  country: 100,
  university: 200,
  program: 200,
  linkedin_url: 500,
  github_url: 500,
  portfolio_url: 500,
  q_proud: 150,
  q_hack: 150,
  q_anything_else: 150,
  dietary: 500,
  accessibility: 1000,
  guardian_name: 100,
  guardian_phone: 30,
  guardian_relationship: 100,
  gender: 100,
  ethnicity: 200,
  teammate_emails_max: 3,
} as const;

export const applicationSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  email: z.string().email().toLowerCase(),
  status: z.enum(APPLICATION_STATUS).default("draft"),
  submitted_at: z.string().datetime().nullable().optional(),
  submission_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),

  first_name: z.string().min(1).max(FIELD_LIMITS.first_name),
  last_name: z.string().min(1).max(FIELD_LIMITS.last_name),
  phone: z.string().min(1).max(FIELD_LIMITS.phone),
  age: z.number().int().min(13).max(120),
  pronouns: z.string().max(FIELD_LIMITS.pronouns).optional().nullable(),
  city: z.string().min(1).max(FIELD_LIMITS.city),
  country: z.string().min(1).max(FIELD_LIMITS.country),

  university: z.string().min(1).max(FIELD_LIMITS.university),
  program: z.string().min(1).max(FIELD_LIMITS.program),
  year_of_study: z.number().int().min(1).max(10),
  grad_date: z.string().min(1),

  hackathons_count: z.number().int().min(0).max(100),
  linkedin_url: z.string().url().max(FIELD_LIMITS.linkedin_url).optional().nullable(),
  github_url: z.string().url().max(FIELD_LIMITS.github_url).optional().nullable(),
  portfolio_url: z.string().url().max(FIELD_LIMITS.portfolio_url).optional().nullable(),
  resume_path: z.string().optional().nullable(),

  q_proud: z.string().min(1).max(2000),
  q_hack: z.string().min(1).max(2000),
  q_anything_else: z.string().max(2000).optional().nullable(),

  team_status: z.enum(TEAM_STATUS),
  teammate_emails: z.array(z.string().email()).max(FIELD_LIMITS.teammate_emails_max).optional().nullable(),

  dietary: z.string().max(FIELD_LIMITS.dietary).optional().nullable(),
  accessibility: z.string().max(FIELD_LIMITS.accessibility).optional().nullable(),
  tshirt_size: z.enum(TSHIRT_SIZES),
  needs_travel_help: z.boolean(),

  gender: z.string().max(FIELD_LIMITS.gender).optional().nullable(),
  ethnicity: z.string().max(FIELD_LIMITS.ethnicity).optional().nullable(),

  guardian_name: z.string().max(FIELD_LIMITS.guardian_name).optional().nullable(),
  guardian_phone: z.string().max(FIELD_LIMITS.guardian_phone).optional().nullable(),
  guardian_relationship: z.string().max(FIELD_LIMITS.guardian_relationship).optional().nullable(),

  consent_coc: z.boolean(),
  consent_privacy: z.boolean(),
  consent_photo: z.boolean().optional().nullable(),
  share_resume_with_sponsors: z.boolean().optional().nullable(),
});

export type Application = z.infer<typeof applicationSchema>;

export const draftSchema = applicationSchema.partial().required({
  email: true,
});

export type DraftApplication = z.infer<typeof draftSchema>;

export const submitSchema = applicationSchema
  .omit({ id: true, user_id: true, status: true, submitted_at: true, created_at: true, updated_at: true })
  .refine(
    (data) => {
      if (data.age < 18) {
        return !!data.guardian_name && !!data.guardian_phone && !!data.guardian_relationship;
      }
      return true;
    },
    { message: "Guardian information required for applicants under 18", path: ["guardian_name"] }
  )
  .refine((data) => data.consent_coc === true, {
    message: "You must agree to the Code of Conduct",
    path: ["consent_coc"],
  })
  .refine((data) => data.consent_privacy === true, {
    message: "You must agree to the Privacy Policy",
    path: ["consent_privacy"],
  });

export type SubmitApplication = z.infer<typeof submitSchema>;
