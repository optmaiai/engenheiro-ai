import { NextResponse } from "next/server";
import { updateAgentPromptSchema } from "@/lib/schemas";
import { isAdminEmail, readJsonBody } from "@/server/http";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

interface RouteContext {
  params: Promise<{ promptId: string }>;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { promptId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isUuid(promptId)) return NextResponse.json({ error: "promptId inválido" }, { status: 400 });

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "JSON inválido" }, { status: 400 });
  }

  const parsed = updateAgentPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("agent_prompts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", promptId)
    .select("id,agent_id,version,title,content,notes,is_active,model_override,created_at,updated_at,created_by")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Prompt não encontrado" }, { status: 404 });
  return NextResponse.json({ prompt: data });
}
