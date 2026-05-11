import { NextResponse } from "next/server";
import { getDashboardMetrics } from "@/server/ai-metrics";
import { getAuthenticatedUser } from "@/server/supabase";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user?.email?.endsWith("@engenheiro.ai")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") || "7");
  const metrics = await getDashboardMetrics(Number.isFinite(days) ? days : 7);
  return NextResponse.json({ metrics });
}
