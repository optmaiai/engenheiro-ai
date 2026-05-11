import { readJsonBody } from "@/server/http";
import { NextResponse } from "next/server";
import { feedbackRequestSchema } from "@/lib/schemas";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "JSON inválido" }, { status: 400 });
  }

  const parsed = feedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: message, error: messageError } = await supabase
    .from("ai_messages")
    .select("id")
    .eq("id", parsed.data.message_id)
    .eq("conversation_id", parsed.data.conversation_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });

  if (!message) {
    return NextResponse.json({ error: "Mensagem não encontrada para este usuário" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("ai_feedback")
    .insert({ user_id: user.id, ...parsed.data })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback_id: data.id }, { status: 201 });
}
