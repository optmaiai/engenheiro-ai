import { NextResponse } from "next/server";
import { getDashboardMetrics } from "@/server/ai-metrics";
import { isAdminEmail } from "@/server/http";
import { getAuthenticatedUser } from "@/server/supabase";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") || "7");
  const metrics = await getDashboardMetrics(Number.isFinite(days) ? days : 7);
  return NextResponse.json({ metrics });
}
