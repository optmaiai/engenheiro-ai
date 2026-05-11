import { NextResponse } from "next/server";
import { feedbackRequestSchema } from "@/lib/schemas";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = feedbackRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_feedback")
    .insert({ user_id: user.id, ...parsed.data })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback_id: data.id }, { status: 201 });
}
