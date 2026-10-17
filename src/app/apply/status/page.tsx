"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMyApplication, type GetApplicationResult } from "@/lib/application/api";
import type { Application } from "@/lib/application/schema";

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "submitted"
      ? "bg-green-100 text-green-800"
      : "bg-yellow-100 text-yellow-800";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${styles}`}>
      {status === "submitted" ? "Submitted" : "Draft"}
    </span>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 text-neutral-900">{value}</dd>
    </div>
  );
}

function ApplicationView({ application }: { application: Application }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold">Application Status</h2>
          <p className="text-sm text-neutral-500">
            {application.submitted_at
              ? `Submitted on ${new Date(application.submitted_at).toLocaleDateString()}`
              : "Not yet submitted"}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Personal Information</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <FieldDisplay label="Name" value={`${application.first_name} ${application.last_name}`} />
          <FieldDisplay label="Email" value={application.email} />
          <FieldDisplay label="Phone" value={application.phone} />
          <FieldDisplay label="Age" value={application.age?.toString()} />
          <FieldDisplay label="Pronouns" value={application.pronouns} />
          <FieldDisplay label="Location" value={`${application.city}, ${application.country}`} />
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Education</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <FieldDisplay label="University" value={application.university} />
          <FieldDisplay label="Program" value={application.program} />
          <FieldDisplay
            label="Year of Study"
            value={application.year_of_study?.toString()}
          />
          <FieldDisplay label="Expected Graduation" value={application.grad_date} />
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Experience</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <FieldDisplay
            label="Hackathons Attended"
            value={application.hackathons_count?.toString()}
          />
          <FieldDisplay label="LinkedIn" value={application.linkedin_url} />
          <FieldDisplay label="GitHub" value={application.github_url} />
          <FieldDisplay label="Portfolio" value={application.portfolio_url} />
          <FieldDisplay
            label="Resume"
            value={application.resume_path ? "Uploaded" : undefined}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Short Answers</h3>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-neutral-500">
              Project you&apos;re most proud of
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-neutral-900">
              {application.q_proud}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">
              A time you hacked something to your advantage
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-neutral-900">
              {application.q_hack}
            </dd>
          </div>
          {application.q_anything_else && (
            <div>
              <dt className="text-sm font-medium text-neutral-500">
                Anything else
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-neutral-900">
                {application.q_anything_else}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Team & Logistics</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <FieldDisplay
            label="Team Status"
            value={
              application.team_status === "solo"
                ? "Going solo"
                : application.team_status === "has_team"
                ? "Has a team"
                : application.team_status === "looking"
                ? "Looking for teammates"
                : undefined
            }
          />
          {application.teammate_emails && application.teammate_emails.length > 0 && (
            <FieldDisplay
              label="Teammates"
              value={application.teammate_emails.join(", ")}
            />
          )}
          <FieldDisplay label="Dietary Restrictions" value={application.dietary} />
          <FieldDisplay label="Accessibility Needs" value={application.accessibility} />
          <FieldDisplay label="T-Shirt Size" value={application.tshirt_size} />
          <FieldDisplay
            label="Needs Travel Help"
            value={application.needs_travel_help ? "Yes" : "No"}
          />
        </dl>
      </section>

      {(application.guardian_name || application.guardian_phone) && (
        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Guardian Information</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <FieldDisplay label="Guardian Name" value={application.guardian_name} />
            <FieldDisplay label="Guardian Phone" value={application.guardian_phone} />
            <FieldDisplay label="Relationship" value={application.guardian_relationship} />
          </dl>
        </section>
      )}
    </div>
  );
}

export default function StatusPage() {
  const router = useRouter();
  const [result, setResult] = useState<GetApplicationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verified = localStorage.getItem("hackhive_verified");

    if (!verified) {
      router.replace("/signup");
      return;
    }

    async function fetchApplication() {
      const res = await getMyApplication();
      setResult(res);
      setIsLoading(false);
    }

    fetchApplication();
  }, [router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-16">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading your application...</p>
        </div>
      </main>
    );
  }

  if (!result || !result.ok || !result.application) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">No Application Found</h1>
          <p className="text-neutral-600">
            You haven&apos;t started an application yet. Get started now!
          </p>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Start Application
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Application</h1>
          <p className="mt-2 text-neutral-600">
            Review your submitted application details below.
          </p>
        </div>
        <ApplicationView application={result.application} />
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-neutral-600 underline hover:text-neutral-900"
          >
            Return to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
