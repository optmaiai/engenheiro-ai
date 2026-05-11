import { readJsonBody } from "@/server/http";
import { NextResponse } from "next/server";
import { createConversationSchema } from "@/lib/schemas";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,agent_id,status,created_at,updated_at,metadata")
    .eq("user_id", user.id)
    .neq("status", "deleted")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "JSON inválido" }, { status: 400 });
  }

  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, ...parsed.data })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation_id: data.id }, { status: 201 });
}
