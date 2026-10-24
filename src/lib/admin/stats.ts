export type StatsApplication = {
  status: string;
  submitted_at: string | null;
  university: string | null;
  hackathons_count: number | null;
  team_status: string | null;
  tshirt_size: string | null;
  needs_travel_help: boolean | null;
  dietary: string | null;
  accessibility: string | null;
  decision?: "accepted" | "waitlisted" | "rejected" | null;
};

export type Breakdown = { label: string; count: number }[];

function breakdown(values: (string | null)[]): Breakdown {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values) {
    const label = value?.trim() || "Not provided";
    const key = label.toLocaleLowerCase("en-US");
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeApplications(applications: StatsApplication[], now = new Date()) {
  const submitted = applications.filter(row => row.status === "submitted");
  const decisions = submitted.map(row => row.decision ?? "pending");
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return {
    total: applications.length,
    submitted: submitted.length,
    drafts: applications.filter(row => row.status === "draft").length,
    pending: decisions.filter(value => value === "pending").length,
    approved: decisions.filter(value => value === "accepted").length,
    waitlisted: decisions.filter(value => value === "waitlisted").length,
    rejected: decisions.filter(value => value === "rejected").length,
    lastSevenDays: submitted.filter(row => {
      const date = Date.parse(row.submitted_at ?? "");
      return date >= weekAgo && date <= now.getTime();
    }).length,
    // The application form asks for hackathons INCLUDING this one.
    firstTime: submitted.filter(row => row.hackathons_count === 1).length,
    experienceUnknown: submitted.filter(row => row.hackathons_count === null || row.hackathons_count < 1).length,
    lookingForTeam: submitted.filter(row => row.team_status === "looking").length,
    hasTeam: submitted.filter(row => row.team_status === "has_team").length,
    solo: submitted.filter(row => row.team_status === "solo").length,
    travelHelp: submitted.filter(row => row.needs_travel_help === true).length,
    dietaryRequests: submitted.filter(row => !!row.dietary?.trim()).length,
    accessibilityRequests: submitted.filter(row => !!row.accessibility?.trim()).length,
    schools: breakdown(submitted.map(row => row.university)),
    shirts: breakdown(submitted.map(row => row.tshirt_size?.trim().toUpperCase() ?? null)),
  };
}

export type ApplicationStats = ReturnType<typeof summarizeApplications>;
