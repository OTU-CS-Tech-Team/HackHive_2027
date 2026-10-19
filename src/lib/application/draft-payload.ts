export interface DraftFormData {
  first_name: string;
  last_name: string;
  phone: string;
  age: string;
  pronouns: string;
  city: string;
  country: string;
  university: string;
  program: string;
  year_of_study: string;
  grad_date: string;
  hackathons_count: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  resume_path: string | null;
  q_proud: string;
  q_hack: string;
  q_anything_else: string;
  team_status: string;
  teammate_emails: string[];
  dietary: string;
  accessibility: string;
  tshirt_size: string;
  needs_travel_help: boolean;
  gender: string;
  ethnicity: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relationship: string;
  consent_coc: boolean;
  consent_privacy: boolean;
  consent_photo: boolean;
  share_resume_with_sponsors: boolean;
}

export const initialFormData: DraftFormData = {
  first_name: "",
  last_name: "",
  phone: "",
  age: "",
  pronouns: "",
  city: "",
  country: "",
  university: "",
  program: "",
  year_of_study: "",
  grad_date: "",
  hackathons_count: "0",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  resume_path: null,
  q_proud: "",
  q_hack: "",
  q_anything_else: "",
  team_status: "",
  teammate_emails: [],
  dietary: "",
  accessibility: "",
  tshirt_size: "",
  needs_travel_help: false,
  gender: "",
  ethnicity: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_relationship: "",
  consent_coc: false,
  consent_privacy: false,
  consent_photo: false,
  share_resume_with_sponsors: false,
};

export function buildDraftPayload(data: DraftFormData): Record<string, unknown> {
  return {
    first_name: data.first_name || "",
    last_name: data.last_name || "",
    phone: data.phone || "",
    age: data.age ? parseInt(data.age, 10) : null,
    pronouns: data.pronouns || "",
    city: data.city || "",
    country: data.country || "",
    university: data.university || "",
    program: data.program || "",
    year_of_study: data.year_of_study || null,
    grad_date: data.grad_date || null,
    hackathons_count: data.hackathons_count && data.hackathons_count !== "0" ? parseInt(data.hackathons_count, 10) : null,
    linkedin_url: data.linkedin_url || "",
    github_url: data.github_url || "",
    portfolio_url: data.portfolio_url || "",
    resume_path: data.resume_path,
    q_proud: data.q_proud || "",
    q_hack: data.q_hack || "",
    q_anything_else: data.q_anything_else || "",
    team_status: data.team_status || null,
    teammate_emails: data.teammate_emails.filter(Boolean),
    dietary: data.dietary || "",
    accessibility: data.accessibility || "",
    tshirt_size: data.tshirt_size || null,
    needs_travel_help: data.needs_travel_help,
    gender: data.gender || "",
    ethnicity: data.ethnicity || "",
    guardian_name: data.guardian_name || "",
    guardian_phone: data.guardian_phone || "",
    guardian_relationship: data.guardian_relationship || "",
    consent_coc: data.consent_coc,
    consent_privacy: data.consent_privacy,
    consent_photo: data.consent_photo,
    share_resume_with_sponsors: data.share_resume_with_sponsors,
  };
}
