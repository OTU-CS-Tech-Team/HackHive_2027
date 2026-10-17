export const APPLICATION_DEADLINE = new Date("2027-01-15T23:59:59Z");

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export const MIN_FORM_TIME_SECONDS = 3;

export const WORD_LIMITS = {
  q_proud: 150,
  q_hack: 150,
  q_anything_else: 150,
} as const;

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
  dietary: 500,
  accessibility: 1000,
  guardian_name: 200,
  guardian_phone: 30,
  guardian_relationship: 100,
  teammate_emails_max: 3,
} as const;

export const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "aol.com",
] as const;

export const COMMON_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
};
