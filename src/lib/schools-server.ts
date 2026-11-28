import "server-only";
import mlhSchools from "@/data/mlh-schools.json";
import { createSchoolSearch, type SchoolSearch } from "@/lib/schools";

// MLH's full school list (~20k names). Server only: it is searched through
// /api/schools and never sent to the browser.
export const MLH_SCHOOLS: readonly string[] = mlhSchools;

let search: SchoolSearch | null = null;

/** The school search, built once per server process on first use. */
export function schoolSearch(): SchoolSearch {
  search ??= createSchoolSearch(MLH_SCHOOLS);
  return search;
}

/**
 * The listed name for a saved school, so drafts saved under an older spelling
 * ("University of British Columbia") come back as the MLH name ("The University
 * of British Columbia"). Left as saved when it matches no school, or more than one.
 */
export function canonicalSchoolName(saved: string): string {
  const matches = schoolSearch().exact(saved);
  return matches.length === 1 ? matches[0] : saved;
}
