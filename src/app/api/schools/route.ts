import type { NextRequest } from "next/server";
import { DEFAULT_LIMIT } from "@/lib/schools";
import { schoolSearch } from "@/lib/schools-server";

// GET /api/schools?q=waterloo          -> { schools: [...] } best matches for the search box
// GET /api/schools?q=uoit&mode=exact   -> { schools: [...] } exact name/alias matches ("Did you mean")
//
// The answer depends only on the query and the list shipped with this build,
// so browsers and CDNs may cache it.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q") ?? "";
  const search = schoolSearch();
  const schools = params.get("mode") === "exact" ? search.exact(query).slice(0, DEFAULT_LIMIT) : search.search(query, DEFAULT_LIMIT);
  return Response.json(
    { schools },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
