import { NextResponse } from "next/server";
import { createAgentPromptSchema } from "@/lib/schemas";
import { isAdminEmail, readJsonBody } from "@/server/http";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");
  const activeOnly = searchParams.get("active_only") === "true";
  const supabase = createServiceClient();

  let query = supabase
    .from("agent_prompts")
    .select("id,agent_id,version,title,content,notes,is_active,model_override,created_at,updated_at,created_by")
    .order("agent_id", { ascending: true })
    .order("version", { ascending: false });

  if (agentId) query = query.eq("agent_id", agentId);
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompts: data || [] });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "JSON inválido" }, { status: 400 });
  }

  const parsed = createAgentPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: latest, error: latestError } = await supabase
    .from("agent_prompts")
    .select("version")
    .eq("agent_id", parsed.data.agent_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) return NextResponse.json({ error: latestError.message }, { status: 500 });

  const version = ((latest?.version as number | undefined) || 0) + 1;
  const { data, error } = await supabase
    .from("agent_prompts")
    .insert({ ...parsed.data, version, created_by: user.id })
    .select("id,agent_id,version,title,content,notes,is_active,model_override,created_at,updated_at,created_by")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompt: data }, { status: 201 });
}
