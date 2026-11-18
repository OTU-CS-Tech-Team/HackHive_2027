import { NextResponse } from "next/server";
import { loadSubmittedApplications } from "@/lib/admin/load-stats";
import { rowsToCsv } from "@/lib/admin/csv";

export async function GET() {
  const rows = await loadSubmittedApplications();
  if (!rows) return new NextResponse("Could not load applications.", { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("\uFEFF" + rowsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="submitted-applications-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}