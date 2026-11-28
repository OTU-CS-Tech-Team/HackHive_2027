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
