import { NextResponse } from "next/server";
import { updateConversationSchema } from "@/lib/schemas";
import { readJsonBody } from "@/server/http";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request, { params }: RouteContext) {
  const { conversationId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(conversationId)) return NextResponse.json({ error: "conversationId inválido" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "20"), 1), 100);
  const supabase = createServiceClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,title,agent_id,status,created_at,updated_at,metadata")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const { data: messages, error: messagesError } = await supabase
    .from("ai_messages")
    .select("id,role,agent_id,content,structured_output,routing_json,citations,tokens_in,tokens_out,latency_ms,cost_usd,created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });

  return NextResponse.json({
    conversation: {
      ...conversation,
      messages: (messages || []).reverse()
    }
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { conversationId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(conversationId)) return NextResponse.json({ error: "conversationId inválido" }, { status: 400 });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "JSON inválido" }, { status: 400 });
  }

  const parsed = updateConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const patch = { ...parsed.data, updated_at: new Date().toISOString() };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .select("id,title,agent_id,status,created_at,updated_at,metadata")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { conversationId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(conversationId)) return NextResponse.json({ error: "conversationId inválido" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
