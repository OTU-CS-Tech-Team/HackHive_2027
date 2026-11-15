export type StatsApplication = {
  status: string;
  submitted_at: string | null;
  university: string | null;
  country: string | null;
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
  const isCanada = (country: unknown) => {
  if (typeof country !== "string") return false;
  const c = country.trim().toLowerCase().replace(/\./g, "");
  return c === "ca" || c === "can" || c.startsWith("canad");
  };
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
    secondHackathon: submitted.filter(row => row.hackathons_count === 1).length,
    firstHackathon: submitted.filter(row => row.hackathons_count === null || row.hackathons_count < 1).length,
    thirdHackathon: submitted.filter(row => row.hackathons_count === 2).length,
    fourthHackathon: submitted.filter(row => row.hackathons_count === 3).length,
    experiencedHackers: submitted.filter(row => row.hackathons_count === 5 || row.hackathons_count === 4).length,
    lookingForTeam: submitted.filter(row => row.team_status === "looking").length,
    hasTeam: submitted.filter(row => row.team_status === "has_team").length,
    solo: submitted.filter(row => row.team_status === "solo").length,
    halal: submitted.filter(row => row.dietary?.toLowerCase().includes("halal") ).length,
    vegetarian: submitted.filter(row => row.dietary?.toLowerCase().includes("veg") ).length,
    nutAllergy: submitted.filter(row => row.dietary?.toLowerCase().includes("nut") ).length,
    glutenFree: submitted.filter(row => row.dietary?.toLowerCase().includes("gluten") ).length,
    lactoseFree: submitted.filter(row => row.dietary?.toLowerCase().includes("lactose") ).length,
    travelHelp: submitted.filter(row => row.needs_travel_help === true).length,
    outOfCountry: submitted.filter(row => row.needs_travel_help === true && row.country && !isCanada(row.country)).length,
    inCountry: submitted.filter(row => row.needs_travel_help === true && row.country && isCanada(row.country)).length,
    dietaryRequests: submitted.filter(row => !!row.dietary?.trim()).length,
    accessibilityRequests: submitted.filter(row => row.accessibility?.trim().toLowerCase()!== "n/a" &&
     row.accessibility?.trim().toLowerCase() !== "none"  && row.accessibility?.trim().toLowerCase() !== "na"
    && row.accessibility?.trim().toLowerCase()!== 'no' && !!row.accessibility?.trim() ).length,
    schools: breakdown(submitted.map(row => row.university)),
    shirts: breakdown(submitted.map(row => row.tshirt_size?.trim().toUpperCase() ?? null)),
  };
}

export type ApplicationStats = ReturnType<typeof summarizeApplications>;
