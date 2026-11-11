"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LogOut } from "lucide-react";
import { FormSection } from "./FormSection";
import { FormField } from "./FormField";
import { TextareaField } from "./TextareaField";
import { SelectField } from "./SelectField";
import { CheckboxField } from "./CheckboxField";
import { RadioGroupField } from "./RadioGroupField";
import { ResumeUpload } from "./ResumeUpload";
import { TeammateEmails } from "./TeammateEmails";
import { SchoolField } from "./SchoolField";
import { OtherLinks } from "./OtherLinks";
import { SelectWithOtherField } from "./SelectWithOtherField";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./TurnstileWidget";
import { Countdown } from "./Countdown";
import { errorClass, hintClass, labelClass, linkClass } from "./styles";
import { signOut } from "@/app/actions/auth";
import {
  saveDraft,
  submitApplication,
  previewIndemnification,
  ERROR_MESSAGES,
  type ErrorCode,
} from "@/lib/application/api";
import {
  saveDraftToLocalStorage,
  loadDraftFromLocalStorage,
  clearDraftFromLocalStorage,
  getOrCreateSubmissionId,
  enqueueSaveDraft,
  countWords,
} from "@/lib/application/form-utils";
import {
  APPLICATION_DEADLINE,
  WORD_LIMITS,
  FIELD_LIMITS,
} from "@/lib/constants";

import {
  buildDraftPayload,
  cleanLinks,
  initialFormData,
  type DraftFormData as FormData,
} from "@/lib/application/draft-payload";

const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const CODE_OF_CONDUCT_URL =
  "https://docs.google.com/document/d/1QBaoQ1ohf4nnto3Gptz6SJzoHe3rNQJM7Rsc2Vbk0S8/edit?usp=sharing";

// Everything the "Agree to all" box ticks. Code of Conduct and Privacy Policy
// share one checkbox, so they move together.
const CONSENT_FIELDS = [
  "consent_coc",
  "consent_privacy",
  "consent_indemnification",
  "consent_esignature",
  "share_resume_with_sponsors",
] as const;

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

// One page per step. `fields` decides which step an error sends them to and
// what the sidebar counts as done, so every form field belongs to one step.
const STEPS: {
  id: string;
  title: string;
  blurb: string;
  sections: { id: string; title: string; under18?: boolean }[];
  fields: (keyof FormData)[];
}[] = [
  {
    id: "about",
    title: "About you",
    blurb:
      "The basics. Everything saves as you go, so you can leave and come back.",
    sections: [
      { id: "basics", title: "The basics" },
      { id: "location", title: "Where you're based" },
      { id: "guardian", title: "Guardian", under18: true },
    ],
    fields: [
      "first_name",
      "last_name",
      "preferred_name",
      "phone",
      "age",
      "pronouns",
      "city",
      "country",
      "guardian_name",
      "guardian_phone",
      "guardian_relationship",
    ],
  },
  {
    id: "school",
    title: "School",
    blurb: "Where you study and what you're working toward.",
    sections: [{ id: "education", title: "Education" }],
    fields: ["university", "program", "year_of_study", "grad_date"],
  },
  {
    id: "experience",
    title: "Experience",
    blurb: "Links and a resume help reviewers see what you've built.",
    sections: [
      { id: "links", title: "Hackathons & links" },
      { id: "resume", title: "Resume" },
    ],
    fields: [
      "hackathons_count",
      "linkedin_url",
      "github_url",
      "portfolio_url",
      "other_links",
      "resume_path",
    ],
  },
  {
    id: "answers",
    title: "Short answers",
    blurb: "Around 150 words each. Be specific and write like you'd talk.",
    sections: [
      { id: "proud", title: "Proudest work" },
      { id: "hack", title: "Your best hack" },
      { id: "else", title: "Anything else" },
    ],
    fields: ["q_proud", "q_hack", "q_anything_else"],
  },
  {
    id: "event",
    title: "The event",
    blurb: "Help us plan teams, food and swag for the weekend.",
    sections: [
      { id: "team", title: "Your team" },
      { id: "logistics", title: "At the event" },
      { id: "demographics", title: "Demographics" },
    ],
    fields: [
      "team_status",
      "teammate_emails",
      "dietary",
      "accessibility",
      "tshirt_size",
      "needs_travel_help",
      "gender",
      "ethnicity",
    ],
  },
  {
    id: "submit",
    title: "Submit",
    blurb: "Check what's left, agree to the policies, and send it in.",
    sections: [
      { id: "left", title: "What's left" },
      { id: "agreements", title: "Agreements" },
    ],
    fields: [
      "consent_coc",
      "consent_privacy",
      "consent_indemnification",
      "consent_esignature",
      "consent_photo",
      "share_resume_with_sponsors",
    ],
  },
];

const LAST_STEP = STEPS.length - 1;

const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";

const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 34V66' fill='none' stroke='%23e0a52c' stroke-opacity='.4'/%3E%3C/svg%3E\")";

interface ApplyFormProps {
  userEmail: string;
  userId: string;
  initialDraft?: Partial<FormData> | null;
  serverUpdatedAt?: string | null;
  serverNow: number;
  deadlinePassed: boolean;
  deadlineLabel: string;
}

function createInitialFormData(
  serverDraft?: Partial<FormData> | null,
): FormData {
  const merged = {
    ...initialFormData,
    ...serverDraft,
  };

  return {
    ...merged,
    teammate_emails: Array.isArray(merged.teammate_emails)
      ? (merged.teammate_emails as string[])
      : [],
    other_links: Array.isArray(merged.other_links)
      ? (merged.other_links as string[])
      : [],
    age: merged.age?.toString() || "",
    hackathons_count: merged.hackathons_count?.toString() || "0",
  } as FormData;
}

function mergeLocalDraft(
  baseData: FormData,
  localData: Record<string, unknown>,
): FormData {
  const merged = { ...baseData, ...localData };
  return {
    ...merged,
    teammate_emails: Array.isArray(merged.teammate_emails)
      ? (merged.teammate_emails as string[])
      : [],
    other_links: Array.isArray(merged.other_links)
      ? (merged.other_links as string[])
      : [],
    age: merged.age?.toString() || "",
    hackathons_count: merged.hackathons_count?.toString() || "0",
  } as FormData;
}

// Server keys are paths like "teammate_emails.0"; each input shows one message.
function firstErrors(
  fieldErrors: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([path, messages]) => [
      path.split(".")[0],
      messages[0],
    ]),
  );
}

function focusField(name: string) {
  const element = document.querySelector(`[name="${name}"]`);
  if (element instanceof HTMLElement) {
    element.focus();
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

const isUnder18 = (data: FormData) =>
  Boolean(data.age) && parseInt(data.age, 10) < 18;

const stepOf = (field: string) =>
  STEPS.findIndex((s) => (s.fields as string[]).includes(field));

// Everything still blocking a submit, keyed by field. Pure, so the sidebar and
// the "What's left" list can use it on every render.
export function getErrors(data: FormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.first_name.trim()) errors.first_name = "First name is required";
  if (!data.last_name.trim()) errors.last_name = "Last name is required";
  if (!data.phone.trim()) errors.phone = "Phone number is required";
  if (!data.age) errors.age = "Age is required";
  else if (parseInt(data.age, 10) < 13)
    errors.age = "You must be at least 13 years old";
  if (!data.city.trim()) errors.city = "City is required";
  if (!data.country.trim()) errors.country = "Country is required";
  if (!data.university.trim())
    errors.university = "Pick your school from the list, or choose “Other”";
  if (!data.program.trim()) errors.program = "Program is required";
  if (!data.year_of_study) errors.year_of_study = "Year of study is required";
  if (!data.grad_date)
    errors.grad_date = "Expected graduation date is required";
  if (!data.resume_path) errors.resume_path = "Resume is required";
  if (!data.q_proud.trim()) errors.q_proud = "This answer is required";
  else if (countWords(data.q_proud) > WORD_LIMITS.q_proud)
    errors.q_proud = `Maximum ${WORD_LIMITS.q_proud} words`;
  if (!data.q_hack.trim()) errors.q_hack = "This answer is required";
  else if (countWords(data.q_hack) > WORD_LIMITS.q_hack)
    errors.q_hack = `Maximum ${WORD_LIMITS.q_hack} words`;
  if (
    data.q_anything_else &&
    countWords(data.q_anything_else) > WORD_LIMITS.q_anything_else
  )
    errors.q_anything_else = `Maximum ${WORD_LIMITS.q_anything_else} words`;
  if (!data.team_status) errors.team_status = "Please select your team status";
  if (!data.tshirt_size) errors.tshirt_size = "T-shirt size is required";
  if (!data.consent_coc || !data.consent_privacy)
    errors.consent_coc =
      "You must agree to the Code of Conduct and Privacy Policy";
  if (!data.consent_indemnification)
    errors.consent_indemnification = "You must accept the indemnification form";
  if (!data.consent_esignature)
    errors.consent_esignature =
      "You must agree that electronic signatures are legally binding";

  if (isUnder18(data)) {
    if (!data.guardian_name.trim())
      errors.guardian_name = "Guardian name is required";
    if (!data.guardian_phone.trim())
      errors.guardian_phone = "Guardian phone is required";
    if (!data.guardian_relationship.trim())
      errors.guardian_relationship = "Guardian relationship is required";
  }

  return errors;
}

function StepMarker({
  n,
  state,
}: {
  n: number;
  state: "current" | "done" | "todo";
}) {
  const tone =
    state === "current"
      ? "bg-hive-honey text-hive-ink"
      : state === "done"
        ? "bg-hive-ink text-white"
        : "bg-hive-line text-hive-muted";
  return (
    <span
      className={`flex h-[30px] w-[27px] shrink-0 items-center justify-center text-xs font-bold ${HEX} ${tone}`}
    >
      {state === "done" ? (
        <Check className="size-3.5" strokeWidth={3} aria-label="done" />
      ) : (
        n
      )}
    </span>
  );
}

export function ApplyForm({
  userEmail,
  userId,
  initialDraft,
  serverUpdatedAt,
  serverNow,
  deadlinePassed,
  deadlineLabel,
}: ApplyFormProps) {
  const router = useRouter();
  const formStartedAt = useRef<number>(serverNow);
  const submissionIdRef = useRef<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const localDraftMergedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [formData, setFormData] = useState<FormData>(() =>
    createInitialFormData(initialDraft),
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDeadlinePassed] = useState<boolean>(deadlinePassed);
  const [isLoadingIndemnification, setIsLoadingIndemnification] =
    useState(false);
  const [indemnificationError, setIndemnificationError] = useState<
    string | null
  >(null);

  const viewIndemnification = async () => {
    setIsLoadingIndemnification(true);
    setIndemnificationError(null);
    try {
      const result = await previewIndemnification({
        first_name: formData.first_name,
        last_name: formData.last_name,
        preferred_name: formData.preferred_name,
        university: formData.university,
        linkedin_url: formData.linkedin_url,
        github_url: formData.github_url,
        portfolio_url: formData.portfolio_url,
      });
      if (!result.ok) {
        setIndemnificationError("Couldn't open the form. Please try again.");
        return;
      }
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
        c.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" }),
      );
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        setIndemnificationError("Allow pop-ups to view the form.");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setIndemnificationError("Couldn't open the form. Please try again.");
    } finally {
      setIsLoadingIndemnification(false);
    }
  };

  useEffect(() => {
    if (localDraftMergedRef.current) return;
    localDraftMergedRef.current = true;

    submissionIdRef.current = getOrCreateSubmissionId(userId);

    const localStored = loadDraftFromLocalStorage(userId);
    if (!localStored) return;

    const localData = localStored.data || {};
    const localSavedAt = localStored._savedAt || 0;
    const serverSavedAt = serverUpdatedAt
      ? new Date(serverUpdatedAt).getTime()
      : 0;

    if (localSavedAt > serverSavedAt && Object.keys(localData).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time merge of localStorage data on mount; not a subscription pattern
      setFormData((prev) => mergeLocalDraft(prev, localData));
    }
  }, [userId, serverUpdatedAt]);

  const under18 = isUnder18(formData);

  const [saveError, setSaveError] = useState<string | null>(null);

  const persistDraft = useCallback(async (fields: Record<string, unknown>) => {
    try {
      const result = await saveDraft(fields);
      const { fieldErrors } = result;
      if (fieldErrors) {
        setErrors((prev) => ({ ...prev, ...firstErrors(fieldErrors) }));
      }
      if (result.ok) {
        // The server keeps every valid field even when some aren't.
        setLastSaved(new Date(result.savedAt));
        setSaveError(
          fieldErrors ? "Draft saved, except the highlighted fields." : null,
        );
        return;
      }
      setSaveError(
        fieldErrors
          ? "Couldn't save draft. Check the highlighted fields."
          : "Couldn't save draft",
      );
    } catch {
      setSaveError("Couldn't save draft");
    }
  }, []);

  // Latest form data, so saving happens outside the state updater (which React
  // may run twice) and every save sends the current draft, never a stale one.
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const saveNow = useCallback(
    (data: FormData) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveDraftToLocalStorage(
        data as unknown as Record<string, unknown>,
        submissionIdRef.current,
        userId,
      );
      enqueueSaveDraft(() => persistDraft(buildDraftPayload(data)));
    },
    [persistDraft, userId],
  );

  const debouncedSave = useCallback(
    (data: FormData) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveDraftToLocalStorage(
        data as unknown as Record<string, unknown>,
        submissionIdRef.current,
        userId,
      );
      saveTimeoutRef.current = setTimeout(() => {
        enqueueSaveDraft(() =>
          persistDraft(buildDraftPayload(formDataRef.current)),
        );
      }, 2000);
    },
    [persistDraft, userId],
  );

  const updateFields = (patch: Partial<FormData>) => {
    const next = { ...formDataRef.current, ...patch };
    formDataRef.current = next;
    setFormData(next);

    // A new or removed resume saves at once with the whole draft, replacing any
    // pending autosave that still holds the old resume path.
    if ("resume_path" in patch) saveNow(next);
    else debouncedSave(next);

    const changed = Object.keys(patch);
    if (changed.some((field) => errors[field])) {
      setErrors((prev) => {
        const next = { ...prev };
        for (const field of changed) delete next[field];
        return next;
      });
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    updateFields({ [field]: value } as Partial<FormData>);
  };

  const allConsentsChecked = CONSENT_FIELDS.every((field) => formData[field]);
  const setAllConsents = (checked: boolean) => {
    updateFields(Object.fromEntries(CONSENT_FIELDS.map((field) => [field, checked])) as Partial<FormData>);
  };

  // The security check only lives on the last step, so its token goes when they leave.
  const changeStep = (index: number) => {
    if (index !== LAST_STEP) setTurnstileToken(null);
    setStep(index);
  };

  const goToStep = (index: number) => {
    changeStep(index);
    window.scrollTo({ top: 0, behavior: "instant" });
    headingRef.current?.focus({ preventScroll: true });
  };

  // Opens the step that holds a field, then focuses it.
  const showField = (name: string) => {
    const index = stepOf(name);
    if (index >= 0) flushSync(() => changeStep(index));
    focusField(name);
  };

  const liveErrors = getErrors(formData);
  const missingPerStep = STEPS.map(
    (s) => s.fields.filter((f) => liveErrors[f]).length,
  );

  const validateForm = (): boolean => {
    const newErrors = getErrors(formData);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      showField(Object.keys(newErrors)[0]);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Read now: currentTarget is gone once this handler awaits.
    const website = String(new FormData(e.currentTarget).get("website") ?? "");

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

    try {
      const result = await submitApplication({
        fields: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          preferred_name: formData.preferred_name || null,
          phone: formData.phone,
          age: parseInt(formData.age, 10),
          pronouns: formData.pronouns || null,
          city: formData.city,
          country: formData.country,
          university: formData.university,
          program: formData.program,
          year_of_study: formData.year_of_study,
          grad_date: formData.grad_date,
          hackathons_count: parseInt(formData.hackathons_count, 10) || null,
          linkedin_url: formData.linkedin_url || null,
          github_url: formData.github_url || null,
          portfolio_url: formData.portfolio_url || null,
          other_links: cleanLinks(formData.other_links),
          resume_path: formData.resume_path,
          q_proud: formData.q_proud,
          q_hack: formData.q_hack,
          q_anything_else: formData.q_anything_else || null,
          team_status: formData.team_status as "solo" | "has_team" | "looking",
          // Only sent while the teammate boxes are on screen.
          teammate_emails:
            formData.team_status === "has_team"
              ? formData.teammate_emails.filter(Boolean)
              : [],
          dietary: formData.dietary || null,
          accessibility: formData.accessibility || null,
          tshirt_size: formData.tshirt_size,
          needs_travel_help: formData.needs_travel_help,
          gender: formData.gender || null,
          ethnicity: formData.ethnicity || null,
          guardian_name: under18 ? formData.guardian_name : null,
          guardian_phone: under18 ? formData.guardian_phone : null,
          guardian_relationship: under18
            ? formData.guardian_relationship
            : null,
          consent_coc: formData.consent_coc,
          consent_privacy: formData.consent_privacy,
          consent_indemnification: formData.consent_indemnification,
          consent_esignature: formData.consent_esignature,
          consent_photo: formData.consent_photo || null,
          share_resume_with_sponsors:
            formData.share_resume_with_sponsors || null,
        },
        turnstileToken,
        startedAt: formStartedAt.current || Date.now(),
        website,
        submissionId: submissionIdRef.current,
      });

      if (result.ok) {
        clearDraftFromLocalStorage(userId);
        router.push("/apply/confirmation");
      } else {
        const errorCode = result.code as ErrorCode;
        const fieldErrors = result.fieldErrors
          ? firstErrors(result.fieldErrors)
          : null;
        const [firstField, firstMessage] =
          Object.entries(fieldErrors ?? {})[0] ?? [];
        // "server" covers several failures, so keep the reason visible in reports.
        const summary =
          errorCode === "server"
            ? `${ERROR_MESSAGES.server} (${result.error})`
            : ERROR_MESSAGES[errorCode] || result.error;
        setSubmitError([summary, firstMessage].filter(Boolean).join(" "));

        if (fieldErrors) {
          setErrors(fieldErrors);
          showField(firstField);
        }

        setTurnstileToken(null);
        turnstileRef.current?.reset();

        if (errorCode === "not_verified") {
          router.push("/auth/login");
        } else if (errorCode === "already_submitted") {
          clearDraftFromLocalStorage(userId);
          router.push("/apply/status");
        }
      }
    } catch (error) {
      console.error("submitApplication failed:", error);
      setSubmitError(ERROR_MESSAGES.network);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDeadlinePassed) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-32 pb-16">
        <div className="rounded-2xl border border-hive-line bg-hive-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-hive-ink">
            Applications are closed
          </h1>
          <p className="mt-2 text-hive-muted">
            The application deadline has passed. Thank you for your interest in
            HackHive 2027!
          </p>
        </div>
      </main>
    );
  }

  const current = STEPS[step];
  // The slider runs 0 to 5, where 5 means "5 or more"; a bigger number from an older draft shows as 5+.
  const hackathons = Math.min(parseInt(formData.hackathons_count, 10) || 0, 5);
  const sectionId = (id: string) => `apply-${id}`;
  const sections = current.sections.filter((s) => !s.under18 || under18);

  const saveStatus = saveError ? (
    <span className="text-red-600">{saveError}</span>
  ) : lastSaved ? (
    <span>
      Saved{" "}
      {lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </span>
  ) : null;

  const panel = (index: number, children: React.ReactNode) => (
    <div hidden={step !== index} className="space-y-6">
      {children}
    </div>
  );

  return (
    <div data-apply-shell className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col border-r border-hive-line bg-hive-panel md:flex">
        <div className="border-b border-hive-line px-7 pt-8 pb-6">
          <Link
            href="/"
            className="-ml-2 inline-flex items-center gap-2 rounded-lg outline-offset-4"
          >
            <Image
              src="/Images/HackhiveLogo.png"
              alt=""
              width={56}
              height={56}
              loading="eager"
            />
            <span className="text-xs font-semibold text-hive-muted">
              HackHive 2027
            </span>
          </Link>
          <p className="mt-2 font-display text-xl font-bold text-hive-ink">
            Application
          </p>
        </div>

        <nav
          aria-label="Application steps"
          className="flex-1 overflow-y-auto px-7 py-6"
        >
          <ol className="relative">
            <span
              aria-hidden="true"
              className="absolute top-5 bottom-5 left-[13px] w-px bg-hive-line"
            />
            {STEPS.map((s, i) => (
              <li key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  className="group flex w-full items-center gap-4 rounded-lg py-2.5 text-left outline-offset-2"
                >
                  <StepMarker
                    n={i + 1}
                    state={
                      i === step
                        ? "current"
                        : missingPerStep[i] === 0
                          ? "done"
                          : "todo"
                    }
                  />
                  <span
                    className={`font-display text-[15px] font-semibold transition-colors ${
                      i === step
                        ? "text-hive-ink"
                        : "text-hive-ink/60 group-hover:text-hive-ink"
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
                {i === step && sections.length > 1 && (
                  <ul className="mb-2">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${sectionId(section.id)}`}
                          className="group flex items-center gap-4 rounded-md py-1.5 text-sm text-hive-muted outline-offset-2 hover:text-hive-ink"
                        >
                          <span className="flex w-[27px] shrink-0 justify-center">
                            <span className="size-1.5 rounded-full bg-[#d9cfb8] ring-4 ring-hive-panel transition-colors group-hover:bg-hive-honey" />
                          </span>
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-3 border-t border-hive-line px-7 py-5">
          <p className="min-h-4 text-xs text-hive-muted" aria-live="polite">
            {saveStatus}
          </p>
          <div className="flex items-center gap-3">
            <span
              className={`flex h-[30px] w-[27px] shrink-0 items-center justify-center bg-hive-honey-soft text-xs font-bold text-hive-ink uppercase ${HEX}`}
            >
              {userEmail.charAt(0)}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-hive-ink"
              title={userEmail}
            >
              {userEmail}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Log out"
                title="Log out"
                className="flex size-8 items-center justify-center rounded-lg text-hive-muted transition-colors hover:bg-hive-line hover:text-hive-ink"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 pt-16 md:pt-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 90% at 10% 0%, rgba(245,184,61,0.32), transparent 70%), radial-gradient(45% 80% at 92% 0%, rgba(98,192,245,0.22), transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
            style={{ backgroundImage: HONEYCOMB, backgroundSize: "42px 75px" }}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="relative mx-auto max-w-[640px] px-4 pt-8 pb-24 sm:px-6 md:pt-14"
        >
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

          <Countdown
            deadline={APPLICATION_DEADLINE.getTime()}
            serverNow={serverNow}
            deadlineLabel={deadlineLabel}
          />

          <div className="mt-10 mb-8">
            <div className="mb-5 flex gap-1.5 md:hidden" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    i === step
                      ? "bg-hive-honey"
                      : missingPerStep[i] === 0
                        ? "bg-hive-ink"
                        : "bg-hive-line"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm font-semibold text-hive-muted">
              Step {step + 1} of {STEPS.length}
              {saveStatus && <span className="md:hidden"> · {saveStatus}</span>}
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 font-display text-4xl font-bold tracking-tight text-hive-ink outline-none"
            >
              {current.title}
            </h1>
            <p className="mt-2 text-[15px] text-hive-muted">{current.blurb}</p>
          </div>

          {panel(
            0,
            <>
              <FormSection id={sectionId("basics")} title="The basics">
                <div className="grid gap-5 sm:grid-cols-2">
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
                  label="Preferred name"
                  name="preferred_name"
                  value={formData.preferred_name}
                  onChange={(v) => updateField("preferred_name", v)}
                  maxLength={FIELD_LIMITS.preferred_name}
                  autoComplete="nickname"
                  placeholder="A nickname, if you go by one"
                  error={errors.preferred_name}
                />
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
                <div className="grid gap-5 sm:grid-cols-2">
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
                    placeholder="e.g. she/her, he/him, they/them"
                  />
                </div>
              </FormSection>

              <FormSection
                id={sectionId("location")}
                title="Where you're based"
              >
                <div className="grid gap-5 sm:grid-cols-2">
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

              {under18 && (
                <FormSection
                  id={sectionId("guardian")}
                  title="Guardian"
                  description="Since you're under 18, we need a parent or guardian we can reach."
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
                    placeholder="e.g. Parent, Legal guardian"
                    error={errors.guardian_relationship}
                  />
                </FormSection>
              )}
            </>,
          )}

          {panel(
            1,
            <FormSection id={sectionId("education")} title="Education">
              <SchoolField
                value={formData.university}
                onChange={(v) => updateField("university", v)}
                maxLength={FIELD_LIMITS.university}
                error={errors.university}
              />
              <FormField
                label="Program or major"
                name="program"
                value={formData.program}
                onChange={(v) => updateField("program", v)}
                required
                maxLength={FIELD_LIMITS.program}
                error={errors.program}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Year of study"
                  name="year_of_study"
                  value={formData.year_of_study}
                  onChange={(v) => updateField("year_of_study", v)}
                  options={YEAR_OF_STUDY_OPTIONS}
                  required
                  placeholder="Select your year"
                  error={errors.year_of_study}
                />
                <FormField
                  label="Expected graduation"
                  name="grad_date"
                  type="date"
                  value={formData.grad_date}
                  onChange={(v) => updateField("grad_date", v)}
                  required
                  error={errors.grad_date}
                />
              </div>
            </FormSection>,
          )}

          {panel(
            2,
            <>
              <FormSection id={sectionId("links")} title="Hackathons & links">
                <div className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <label htmlFor="hackathons_count" className={labelClass}>
                        How many hackathons have you been to?
                      </label>
                      <p className={`mt-1 ${hintClass}`}>
                        {hackathons === 0
                          ? "First one? You're in good company."
                          : hackathons === 5
                            ? "A seasoned hacker."
                            : "Nice, welcome back."}
                      </p>
                    </div>
                    <span
                      className="font-display text-1.5xl font-bold text-hive-ink tabular-nums"
                      aria-hidden="true"
                    >
                      {hackathons === 5 ? "5+" : hackathons}
                    </span>
                  </div>
                  <input
                    id="hackathons_count"
                    name="hackathons_count"
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={hackathons}
                    onChange={(e) =>
                      updateField("hackathons_count", e.target.value)
                    }
                    aria-valuetext={
                      hackathons === 5 ? "5 or more" : String(hackathons)
                    }
                    className="hive-range block w-full"
                    style={
                      { "--fill": `${hackathons * 20}%` } as React.CSSProperties
                    }
                  />
                  <div
                    className="flex justify-between px-[3px] text-xs font-medium text-hive-muted"
                    aria-hidden="true"
                  >
                    {["0", "1", "2", "3", "4", "5+"].map((n) => (
                      <span key={n} className="w-4 text-center">
                        {n}
                      </span>
                    ))}
                  </div>
                  {errors.hackathons_count && (
                    <p className={errorClass} role="alert">
                      {errors.hackathons_count}
                    </p>
                  )}
                </div>
                <FormField
                  label="LinkedIn"
                  name="linkedin_url"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(v) => updateField("linkedin_url", v)}
                  maxLength={FIELD_LIMITS.linkedin_url}
                  placeholder="https://linkedin.com/in/..."
                  error={errors.linkedin_url}
                />
                <FormField
                  label="GitHub"
                  name="github_url"
                  type="url"
                  value={formData.github_url}
                  onChange={(v) => updateField("github_url", v)}
                  maxLength={FIELD_LIMITS.github_url}
                  placeholder="https://github.com/..."
                  error={errors.github_url}
                />
                <FormField
                  label="Portfolio"
                  name="portfolio_url"
                  type="url"
                  value={formData.portfolio_url}
                  onChange={(v) => updateField("portfolio_url", v)}
                  maxLength={FIELD_LIMITS.portfolio_url}
                  placeholder="https://..."
                  error={errors.portfolio_url}
                />
                <OtherLinks
                  value={formData.other_links}
                  onChange={(v) => updateField("other_links", v)}
                  error={errors.other_links}
                />
              </FormSection>

              <FormSection id={sectionId("resume")} title="Resume">
                <ResumeUpload
                  value={formData.resume_path}
                  onChange={(v) => updateField("resume_path", v)}
                  error={errors.resume_path}
                />
              </FormSection>
            </>,
          )}

          {panel(
            3,
            <>
              <FormSection id={sectionId("proud")} title="Proudest work">
                <TextareaField
                  label="The project or work you're most proud of, and what you built yourself"
                  name="q_proud"
                  value={formData.q_proud}
                  onChange={(v) => updateField("q_proud", v)}
                  required
                  wordLimit={WORD_LIMITS.q_proud}
                  rows={7}
                  error={errors.q_proud}
                />
              </FormSection>
              <FormSection id={sectionId("hack")} title="Your best hack">
                <TextareaField
                  label="A time you hacked something to your advantage (doesn't have to be tech)"
                  name="q_hack"
                  value={formData.q_hack}
                  onChange={(v) => updateField("q_hack", v)}
                  required
                  wordLimit={WORD_LIMITS.q_hack}
                  rows={7}
                  error={errors.q_hack}
                />
              </FormSection>
              <FormSection id={sectionId("else")} title="Anything else">
                <TextareaField
                  label="Anything else you'd like us to know?"
                  name="q_anything_else"
                  value={formData.q_anything_else}
                  onChange={(v) => updateField("q_anything_else", v)}
                  wordLimit={WORD_LIMITS.q_anything_else}
                  rows={4}
                  error={errors.q_anything_else}
                />
              </FormSection>
            </>,
          )}

          {panel(
            4,
            <>
              <FormSection id={sectionId("team")} title="Your team">
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
                    error={errors.teammate_emails}
                  />
                )}
              </FormSection>

              <FormSection id={sectionId("logistics")} title="At the event">
                <SelectField
                  label="T-shirt size"
                  name="tshirt_size"
                  value={formData.tshirt_size}
                  onChange={(v) => updateField("tshirt_size", v)}
                  options={TSHIRT_SIZES.map((s) => ({ value: s, label: s }))}
                  required
                  placeholder="Select your size"
                  error={errors.tshirt_size}
                />
                <TextareaField
                  label="Dietary restrictions or allergies"
                  name="dietary"
                  value={formData.dietary}
                  onChange={(v) => updateField("dietary", v)}
                  maxLength={FIELD_LIMITS.dietary}
                  rows={2}
                  placeholder="e.g. vegetarian, nut allergy, halal"
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
                <CheckboxField
                  label="I need help with travel costs"
                  name="needs_travel_help"
                  checked={formData.needs_travel_help}
                  onChange={(v) => updateField("needs_travel_help", v)}
                  description="We may be able to reimburse travel for some hackers."
                />
              </FormSection>

              <FormSection
                id={sectionId("demographics")}
                title="Demographics"
                description="Optional. This helps us understand who we're reaching, and never affects your application."
              >
                <SelectWithOtherField
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={(v) => updateField("gender", v)}
                  maxLength={FIELD_LIMITS.gender}
                  options={[
                    { value: "woman", label: "Woman" },
                    { value: "man", label: "Man" },
                    { value: "non-binary", label: "Non-binary" },
                    { value: "other", label: "Other" },
                    { value: "prefer-not-to-say", label: "Prefer not to say" },
                  ]}
                  placeholder="Select..."
                />
                <SelectWithOtherField
                  label="Race/Ethnicity"
                  name="ethnicity"
                  value={formData.ethnicity}
                  onChange={(v) => updateField("ethnicity", v)}
                  maxLength={FIELD_LIMITS.ethnicity}
                  options={[
                    { value: "asian", label: "Asian" },
                    { value: "black", label: "Black or African American" },
                    { value: "hispanic", label: "Hispanic or Latino" },
                    { value: "indigenous", label: "Indigenous" },
                    {
                      value: "middle-eastern",
                      label: "Middle Eastern or North African",
                    },
                    {
                      value: "pacific-islander",
                      label: "Native Hawaiian or Pacific Islander",
                    },
                    { value: "white", label: "White" },
                    { value: "multiracial", label: "Two or more races" },
                    { value: "other", label: "Other" },
                    { value: "prefer-not-to-say", label: "Prefer not to say" },
                  ]}
                  placeholder="Select..."
                />
              </FormSection>
            </>,
          )}

          {panel(
            LAST_STEP,
            <>
              <FormSection id={sectionId("left")} title="What's left">
                {missingPerStep.slice(0, LAST_STEP).every((n) => n === 0) ? (
                  <p className="flex items-center gap-2.5 text-sm font-medium text-hive-ink">
                    <Check
                      className="size-4 text-hive-honey"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    Every step is filled in. Agree below and you&apos;re ready
                    to submit.
                  </p>
                ) : (
                  <ul className="divide-y divide-hive-line">
                    {STEPS.slice(0, LAST_STEP).map((s, i) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="flex items-center gap-3 text-sm font-medium text-hive-ink">
                          <StepMarker
                            n={i + 1}
                            state={missingPerStep[i] === 0 ? "done" : "todo"}
                          />
                          {s.title}
                        </span>
                        {missingPerStep[i] === 0 ? (
                          <span className="text-[13px] text-hive-muted">
                            Done
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => goToStep(i)}
                            className={`text-[13px] ${linkClass}`}
                          >
                            {missingPerStep[i]} to fill in
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </FormSection>

              <FormSection id={sectionId("agreements")} title="Agreements">
                <div className="border-b border-hive-line pb-5">
                  <CheckboxField
                    label="Agree to all"
                    name="consent_all"
                    checked={allConsentsChecked}
                    onChange={setAllConsents}
                  />
                </div>
                <div className="space-y-2">
                  <CheckboxField
                    label="I agree to the HackHive Code of Conduct and Privacy Policy"
                    name="consent_coc"
                    checked={formData.consent_coc && formData.consent_privacy}
                    onChange={(v) =>
                      updateFields({ consent_coc: v, consent_privacy: v })
                    }
                    required
                    error={errors.consent_coc || errors.consent_privacy}
                  />
                  {formData.consent_coc && formData.consent_privacy && (
                    <div className="pl-11 text-sm">
                      <a
                        href={CODE_OF_CONDUCT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        View Code of Conduct and Privacy Policy
                      </a>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <CheckboxField
                    label="I accept the external guest indemnification form"
                    name="consent_indemnification"
                    checked={formData.consent_indemnification}
                    onChange={(v) => updateField("consent_indemnification", v)}
                    required
                    error={errors.consent_indemnification}
                  />
                  {formData.consent_indemnification && (
                    <div className="pl-11 text-sm">
                      <button
                        type="button"
                        onClick={() => void viewIndemnification()}
                        disabled={isLoadingIndemnification}
                        className={linkClass}
                      >
                        {isLoadingIndemnification
                          ? "Opening form..."
                          : "View form"}
                      </button>
                      {indemnificationError && (
                        <p className="mt-1 text-red-600" role="alert">
                          {indemnificationError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <CheckboxField
                  label="The parties agree that electronic signatures are legally binding"
                  name="consent_esignature"
                  checked={formData.consent_esignature}
                  onChange={(v) => updateField("consent_esignature", v)}
                  required
                  error={errors.consent_esignature}
                />
                <CheckboxField
                  label="I'd like to share my resume with event sponsors"
                  name="share_resume_with_sponsors"
                  checked={formData.share_resume_with_sponsors}
                  onChange={(v) => updateField("share_resume_with_sponsors", v)}
                />
              </FormSection>
            </>,
          )}

          <div className="mt-10 border-t border-hive-line pt-6">
            {step === LAST_STEP && (
              <div className="mb-6 space-y-4">
                <TurnstileWidget
                  ref={turnstileRef}
                  onVerify={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
                {submitError && (
                  <div
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700"
                    role="alert"
                  >
                    {submitError}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => goToStep(step - 1)}
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-hive-muted transition-colors hover:text-hive-ink"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </button>
              ) : (
                <span />
              )}

              {step < LAST_STEP ? (
                <button
                  type="button"
                  onClick={() => goToStep(step + 1)}
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-hive-ink px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#1d4258] active:scale-[0.98]"
                >
                  Next: {STEPS[step + 1].title}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !turnstileToken}
                  className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-hive-honey px-6 font-display text-base font-bold text-hive-ink transition-[filter,transform] hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit application"}
                </button>
              )}
            </div>

            {step === LAST_STEP && (
              <p className="mt-4 text-right text-[13px] text-hive-muted">
                You can&apos;t edit your application after submitting.
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
