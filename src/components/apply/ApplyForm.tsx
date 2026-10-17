"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FormSection } from "./FormSection";
import { FormField } from "./FormField";
import { TextareaField } from "./TextareaField";
import { SelectField } from "./SelectField";
import { CheckboxField } from "./CheckboxField";
import { RadioGroupField } from "./RadioGroupField";
import { ResumeUpload } from "./ResumeUpload";
import { TeammateEmails } from "./TeammateEmails";
import { TurnstileWidget } from "./TurnstileWidget";
import { TSHIRT_SIZES, TEAM_STATUS, FIELD_LIMITS, type DraftApplication } from "@/lib/application/schema";
import { saveDraft, submitApplication, ERROR_MESSAGES, type ErrorCode } from "@/lib/application/api";
import {
  saveDraftToLocalStorage,
  loadDraftFromLocalStorage,
  clearDraftFromLocalStorage,
  generateSubmissionId,
  countWords,
} from "@/lib/application/form-utils";
import { APPLICATION_DEADLINE, WORD_LIMITS } from "@/lib/constants";

function getInitialFormStartTime(): number {
  return Date.now();
}

function checkDeadlinePassed(): boolean {
  return new Date() > APPLICATION_DEADLINE;
}

function loadSavedDraft(): FormData {
  const saved = loadDraftFromLocalStorage();
  if (!saved) return initialFormData;
  return {
    ...initialFormData,
    ...saved,
    teammate_emails: Array.isArray(saved.teammate_emails) ? saved.teammate_emails as string[] : [],
  } as FormData;
}

const YEAR_OF_STUDY_OPTIONS = [
  { value: "1", label: "1st year" },
  { value: "2", label: "2nd year" },
  { value: "3", label: "3rd year" },
  { value: "4", label: "4th year" },
  { value: "5", label: "5th year+" },
  { value: "6", label: "Graduate" },
];

const TEAM_STATUS_OPTIONS = [
  { value: "solo", label: "I'm going solo" },
  { value: "has_team", label: "I already have a team" },
  { value: "looking", label: "I'm looking for teammates" },
];

interface FormData {
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

const initialFormData: FormData = {
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

interface ApplyFormProps {
  userEmail: string;
}

export function ApplyForm({ userEmail }: ApplyFormProps) {
  const router = useRouter();
  const savedDraft = useMemo(() => loadSavedDraft(), []);
  const [formData, setFormData] = useState<FormData>(savedDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isDeadlinePassed = useMemo(() => checkDeadlinePassed(), []);
  const formStartedAt = useRef<number | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (formStartedAt.current === null) {
    formStartedAt.current = getInitialFormStartTime();
  }

  const isUnder18 = formData.age && parseInt(formData.age, 10) < 18;

  const debouncedSave = useCallback((data: FormData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveDraftToLocalStorage(data as unknown as Record<string, unknown>);

    saveTimeoutRef.current = setTimeout(async () => {
      const draftData: Partial<DraftApplication> = {
        email: userEmail,
        first_name: data.first_name || undefined,
        last_name: data.last_name || undefined,
        phone: data.phone || undefined,
        age: data.age ? parseInt(data.age, 10) : undefined,
        pronouns: data.pronouns || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        university: data.university || undefined,
        program: data.program || undefined,
        year_of_study: data.year_of_study ? parseInt(data.year_of_study, 10) : undefined,
        grad_date: data.grad_date || undefined,
        hackathons_count: data.hackathons_count ? parseInt(data.hackathons_count, 10) : undefined,
        linkedin_url: data.linkedin_url || undefined,
        github_url: data.github_url || undefined,
        portfolio_url: data.portfolio_url || undefined,
        resume_path: data.resume_path || undefined,
        q_proud: data.q_proud || undefined,
        q_hack: data.q_hack || undefined,
        q_anything_else: data.q_anything_else || undefined,
        team_status: data.team_status as "solo" | "has_team" | "looking" | undefined,
        teammate_emails: data.teammate_emails.filter(Boolean).length > 0 ? data.teammate_emails.filter(Boolean) : undefined,
        dietary: data.dietary || undefined,
        accessibility: data.accessibility || undefined,
        tshirt_size: data.tshirt_size as typeof TSHIRT_SIZES[number] | undefined,
        needs_travel_help: data.needs_travel_help,
        gender: data.gender || undefined,
        ethnicity: data.ethnicity || undefined,
        guardian_name: data.guardian_name || undefined,
        guardian_phone: data.guardian_phone || undefined,
        guardian_relationship: data.guardian_relationship || undefined,
        consent_coc: data.consent_coc,
        consent_privacy: data.consent_privacy,
        consent_photo: data.consent_photo,
        share_resume_with_sponsors: data.share_resume_with_sponsors,
      };

      const result = await saveDraft(draftData);
      if (result.ok) {
        setLastSaved(new Date(result.savedAt));
      }
    }, 2000);
  }, [userEmail]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      debouncedSave(next);
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) newErrors.first_name = "First name is required";
    if (!formData.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.age) newErrors.age = "Age is required";
    else if (parseInt(formData.age, 10) < 13) newErrors.age = "You must be at least 13 years old";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.country.trim()) newErrors.country = "Country is required";
    if (!formData.university.trim()) newErrors.university = "University is required";
    if (!formData.program.trim()) newErrors.program = "Program is required";
    if (!formData.year_of_study) newErrors.year_of_study = "Year of study is required";
    if (!formData.grad_date) newErrors.grad_date = "Expected graduation date is required";
    if (!formData.resume_path) newErrors.resume_path = "Resume is required";
    if (!formData.q_proud.trim()) newErrors.q_proud = "This answer is required";
    else if (countWords(formData.q_proud) > WORD_LIMITS.q_proud)
      newErrors.q_proud = `Maximum ${WORD_LIMITS.q_proud} words`;
    if (!formData.q_hack.trim()) newErrors.q_hack = "This answer is required";
    else if (countWords(formData.q_hack) > WORD_LIMITS.q_hack)
      newErrors.q_hack = `Maximum ${WORD_LIMITS.q_hack} words`;
    if (formData.q_anything_else && countWords(formData.q_anything_else) > WORD_LIMITS.q_anything_else)
      newErrors.q_anything_else = `Maximum ${WORD_LIMITS.q_anything_else} words`;
    if (!formData.team_status) newErrors.team_status = "Please select your team status";
    if (!formData.tshirt_size) newErrors.tshirt_size = "T-shirt size is required";
    if (!formData.consent_coc) newErrors.consent_coc = "You must agree to the Code of Conduct";
    if (!formData.consent_privacy) newErrors.consent_privacy = "You must agree to the Privacy Policy";

    if (isUnder18) {
      if (!formData.guardian_name.trim()) newErrors.guardian_name = "Guardian name is required";
      if (!formData.guardian_phone.trim()) newErrors.guardian_phone = "Guardian phone is required";
      if (!formData.guardian_relationship.trim())
        newErrors.guardian_relationship = "Guardian relationship is required";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element instanceof HTMLElement) {
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (isDeadlinePassed) {
      setSubmitError(ERROR_MESSAGES.locked);
      return;
    }

    if (!validateForm()) return;

    if (!turnstileToken) {
      setSubmitError("Please complete the security check");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    if (!submissionIdRef.current) {
      submissionIdRef.current = generateSubmissionId();
    }

    try {
      const result = await submitApplication(
        {
          email: userEmail,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          age: parseInt(formData.age, 10),
          pronouns: formData.pronouns || null,
          city: formData.city,
          country: formData.country,
          university: formData.university,
          program: formData.program,
          year_of_study: parseInt(formData.year_of_study, 10),
          grad_date: formData.grad_date,
          hackathons_count: parseInt(formData.hackathons_count, 10),
          linkedin_url: formData.linkedin_url || null,
          github_url: formData.github_url || null,
          portfolio_url: formData.portfolio_url || null,
          resume_path: formData.resume_path,
          q_proud: formData.q_proud,
          q_hack: formData.q_hack,
          q_anything_else: formData.q_anything_else || null,
          team_status: formData.team_status as typeof TEAM_STATUS[number],
          teammate_emails: formData.teammate_emails.filter(Boolean),
          dietary: formData.dietary || null,
          accessibility: formData.accessibility || null,
          tshirt_size: formData.tshirt_size as typeof TSHIRT_SIZES[number],
          needs_travel_help: formData.needs_travel_help,
          gender: formData.gender || null,
          ethnicity: formData.ethnicity || null,
          guardian_name: isUnder18 ? formData.guardian_name : null,
          guardian_phone: isUnder18 ? formData.guardian_phone : null,
          guardian_relationship: isUnder18 ? formData.guardian_relationship : null,
          consent_coc: formData.consent_coc,
          consent_privacy: formData.consent_privacy,
          consent_photo: formData.consent_photo || null,
          share_resume_with_sponsors: formData.share_resume_with_sponsors || null,
          submission_id: submissionIdRef.current,
        },
        {
          turnstileToken,
          startedAt: formStartedAt.current || Date.now(),
          website: "",
          submissionId: submissionIdRef.current,
        }
      );

      if (result.ok) {
        clearDraftFromLocalStorage();
        router.push("/apply/confirmation");
      } else {
        const errorCode = result.code as ErrorCode;
        setSubmitError(ERROR_MESSAGES[errorCode] || result.error);

        if (result.fieldErrors) {
          setErrors(
            Object.fromEntries(
              Object.entries(result.fieldErrors).map(([k, v]) => [k, v[0]])
            )
          );
        }

        if (errorCode === "not_verified") {
          router.push("/verify");
        } else if (errorCode === "already_submitted") {
          router.push("/apply/status");
        }
      }
    } catch {
      setSubmitError(ERROR_MESSAGES.server);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDeadlinePassed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">Applications Closed</h2>
          <p className="mt-2 text-red-700">
            The application deadline has passed. Thank you for your interest in HackHive 2027!
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Honeypot field - visually hidden but not display:none */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor="website">Leave this empty</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {lastSaved && (
        <p className="text-center text-sm text-neutral-500">
          Draft saved {lastSaved.toLocaleTimeString()}
        </p>
      )}

      <FormSection title="Basics" description="Tell us about yourself">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="First name"
            name="first_name"
            value={formData.first_name}
            onChange={(v) => updateField("first_name", v)}
            required
            maxLength={FIELD_LIMITS.first_name}
            autoComplete="given-name"
            error={errors.first_name}
          />
          <FormField
            label="Last name"
            name="last_name"
            value={formData.last_name}
            onChange={(v) => updateField("last_name", v)}
            required
            maxLength={FIELD_LIMITS.last_name}
            autoComplete="family-name"
            error={errors.last_name}
          />
        </div>
        <FormField
          label="Email"
          name="email"
          type="email"
          value={userEmail}
          onChange={() => {}}
          disabled
          autoComplete="email"
        />
        <FormField
          label="Phone number"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={(v) => updateField("phone", v)}
          required
          maxLength={FIELD_LIMITS.phone}
          autoComplete="tel"
          error={errors.phone}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Age"
            name="age"
            type="number"
            value={formData.age}
            onChange={(v) => updateField("age", v)}
            required
            min={13}
            max={120}
            error={errors.age}
          />
          <FormField
            label="Pronouns"
            name="pronouns"
            value={formData.pronouns}
            onChange={(v) => updateField("pronouns", v)}
            maxLength={FIELD_LIMITS.pronouns}
            placeholder="e.g., she/her, he/him, they/them"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="City"
            name="city"
            value={formData.city}
            onChange={(v) => updateField("city", v)}
            required
            maxLength={FIELD_LIMITS.city}
            autoComplete="address-level2"
            error={errors.city}
          />
          <FormField
            label="Country"
            name="country"
            value={formData.country}
            onChange={(v) => updateField("country", v)}
            required
            maxLength={FIELD_LIMITS.country}
            autoComplete="country-name"
            error={errors.country}
          />
        </div>
      </FormSection>

      <FormSection title="School" description="Your education details">
        <FormField
          label="University"
          name="university"
          value={formData.university}
          onChange={(v) => updateField("university", v)}
          required
          maxLength={FIELD_LIMITS.university}
          autoComplete="organization"
          error={errors.university}
        />
        <FormField
          label="Program/Major"
          name="program"
          value={formData.program}
          onChange={(v) => updateField("program", v)}
          required
          maxLength={FIELD_LIMITS.program}
          error={errors.program}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Year of study"
            name="year_of_study"
            value={formData.year_of_study}
            onChange={(v) => updateField("year_of_study", v)}
            options={YEAR_OF_STUDY_OPTIONS}
            required
            error={errors.year_of_study}
          />
          <FormField
            label="Expected graduation date"
            name="grad_date"
            type="date"
            value={formData.grad_date}
            onChange={(v) => updateField("grad_date", v)}
            required
            error={errors.grad_date}
          />
        </div>
      </FormSection>

      <FormSection title="Experience" description="Your hacking background">
        <FormField
          label="Number of hackathons attended"
          name="hackathons_count"
          type="number"
          value={formData.hackathons_count}
          onChange={(v) => updateField("hackathons_count", v)}
          min={0}
          max={100}
          description="Including this one, if accepted"
        />
        <FormField
          label="LinkedIn URL"
          name="linkedin_url"
          type="url"
          value={formData.linkedin_url}
          onChange={(v) => updateField("linkedin_url", v)}
          maxLength={FIELD_LIMITS.linkedin_url}
          placeholder="https://linkedin.com/in/..."
        />
        <FormField
          label="GitHub URL"
          name="github_url"
          type="url"
          value={formData.github_url}
          onChange={(v) => updateField("github_url", v)}
          maxLength={FIELD_LIMITS.github_url}
          placeholder="https://github.com/..."
        />
        <FormField
          label="Portfolio URL"
          name="portfolio_url"
          type="url"
          value={formData.portfolio_url}
          onChange={(v) => updateField("portfolio_url", v)}
          maxLength={FIELD_LIMITS.portfolio_url}
          placeholder="https://..."
        />
        <ResumeUpload
          value={formData.resume_path}
          onChange={(v) => updateField("resume_path", v)}
          error={errors.resume_path}
        />
      </FormSection>

      <FormSection title="Short Answers" description="Each answer should be ~150 words">
        <TextareaField
          label="The project or work you're most proud of, and what you built yourself"
          name="q_proud"
          value={formData.q_proud}
          onChange={(v) => updateField("q_proud", v)}
          required
          wordLimit={WORD_LIMITS.q_proud}
          rows={5}
          error={errors.q_proud}
        />
        <TextareaField
          label="A time you hacked something to your advantage (doesn't have to be tech)"
          name="q_hack"
          value={formData.q_hack}
          onChange={(v) => updateField("q_hack", v)}
          required
          wordLimit={WORD_LIMITS.q_hack}
          rows={5}
          error={errors.q_hack}
        />
        <TextareaField
          label="Anything else you'd like us to know? (optional)"
          name="q_anything_else"
          value={formData.q_anything_else}
          onChange={(v) => updateField("q_anything_else", v)}
          wordLimit={WORD_LIMITS.q_anything_else}
          rows={4}
          error={errors.q_anything_else}
        />
      </FormSection>

      <FormSection title="Team" description="Your hackathon team plans">
        <RadioGroupField
          label="Team status"
          name="team_status"
          value={formData.team_status}
          onChange={(v) => updateField("team_status", v)}
          options={TEAM_STATUS_OPTIONS}
          required
          error={errors.team_status}
        />
        {formData.team_status === "has_team" && (
          <TeammateEmails
            value={formData.teammate_emails}
            onChange={(v) => updateField("teammate_emails", v)}
          />
        )}
      </FormSection>

      <FormSection title="Logistics" description="Help us prepare for you">
        <TextareaField
          label="Dietary restrictions or allergies"
          name="dietary"
          value={formData.dietary}
          onChange={(v) => updateField("dietary", v)}
          maxLength={FIELD_LIMITS.dietary}
          rows={2}
          placeholder="e.g., vegetarian, nut allergy, halal, etc."
        />
        <TextareaField
          label="Accessibility needs"
          name="accessibility"
          value={formData.accessibility}
          onChange={(v) => updateField("accessibility", v)}
          maxLength={FIELD_LIMITS.accessibility}
          rows={2}
          placeholder="Let us know how we can accommodate you"
        />
        <SelectField
          label="T-shirt size"
          name="tshirt_size"
          value={formData.tshirt_size}
          onChange={(v) => updateField("tshirt_size", v)}
          options={TSHIRT_SIZES.map((s) => ({ value: s, label: s }))}
          required
          error={errors.tshirt_size}
        />
        <CheckboxField
          label="I need help with travel costs"
          name="needs_travel_help"
          checked={formData.needs_travel_help}
          onChange={(v) => updateField("needs_travel_help", v)}
          description="We may be able to provide travel reimbursements for select hackers"
        />
      </FormSection>

      <FormSection
        title="Demographics"
        description="Optional. This helps us understand who we're reaching."
      >
        <SelectField
          label="Gender"
          name="gender"
          value={formData.gender}
          onChange={(v) => updateField("gender", v)}
          options={[
            { value: "woman", label: "Woman" },
            { value: "man", label: "Man" },
            { value: "non-binary", label: "Non-binary" },
            { value: "other", label: "Other" },
            { value: "prefer-not-to-say", label: "Prefer not to say" },
          ]}
          placeholder="Select..."
        />
        <SelectField
          label="Race/Ethnicity"
          name="ethnicity"
          value={formData.ethnicity}
          onChange={(v) => updateField("ethnicity", v)}
          options={[
            { value: "asian", label: "Asian" },
            { value: "black", label: "Black or African American" },
            { value: "hispanic", label: "Hispanic or Latino" },
            { value: "indigenous", label: "Indigenous" },
            { value: "middle-eastern", label: "Middle Eastern or North African" },
            { value: "pacific-islander", label: "Native Hawaiian or Pacific Islander" },
            { value: "white", label: "White" },
            { value: "multiracial", label: "Two or more races" },
            { value: "other", label: "Other" },
            { value: "prefer-not-to-say", label: "Prefer not to say" },
          ]}
          placeholder="Select..."
        />
      </FormSection>

      {isUnder18 && (
        <FormSection
          title="Guardian Information"
          description="Required for applicants under 18"
        >
          <FormField
            label="Guardian/Emergency contact name"
            name="guardian_name"
            value={formData.guardian_name}
            onChange={(v) => updateField("guardian_name", v)}
            required
            maxLength={FIELD_LIMITS.guardian_name}
            autoComplete="name"
            error={errors.guardian_name}
          />
          <FormField
            label="Guardian phone number"
            name="guardian_phone"
            type="tel"
            value={formData.guardian_phone}
            onChange={(v) => updateField("guardian_phone", v)}
            required
            maxLength={FIELD_LIMITS.guardian_phone}
            autoComplete="tel"
            error={errors.guardian_phone}
          />
          <FormField
            label="Relationship to you"
            name="guardian_relationship"
            value={formData.guardian_relationship}
            onChange={(v) => updateField("guardian_relationship", v)}
            required
            maxLength={FIELD_LIMITS.guardian_relationship}
            placeholder="e.g., Parent, Legal guardian"
            error={errors.guardian_relationship}
          />
        </FormSection>
      )}

      <FormSection title="Consent">
        <CheckboxField
          label="I agree to the HackHive Code of Conduct"
          name="consent_coc"
          checked={formData.consent_coc}
          onChange={(v) => updateField("consent_coc", v)}
          required
          error={errors.consent_coc}
        />
        <CheckboxField
          label="I agree to the HackHive Privacy Policy"
          name="consent_privacy"
          checked={formData.consent_privacy}
          onChange={(v) => updateField("consent_privacy", v)}
          required
          error={errors.consent_privacy}
        />
        <CheckboxField
          label="I consent to being photographed/recorded at the event"
          name="consent_photo"
          checked={formData.consent_photo}
          onChange={(v) => updateField("consent_photo", v)}
        />
        <CheckboxField
          label="I'd like to share my resume with event sponsors"
          name="share_resume_with_sponsors"
          checked={formData.share_resume_with_sponsors}
          onChange={(v) => updateField("share_resume_with_sponsors", v)}
          description="Sponsors may contact you about internship and job opportunities"
        />
      </FormSection>

      <div className="space-y-4">
        <TurnstileWidget
          onVerify={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />

        {submitError && (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-700" role="alert">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !turnstileToken}
          className="flex w-full items-center justify-center rounded-lg bg-neutral-900 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </button>

        <p className="text-center text-sm text-neutral-500">
          You can&apos;t edit your application after submitting.
        </p>
      </div>
    </form>
  );
}
