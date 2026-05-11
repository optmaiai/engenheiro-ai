import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/schemas";
import { runChatCompletion } from "@/server/ai-chat.functions";
import { getAuthenticatedUser } from "@/server/supabase";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runChatCompletion({
      userId: user.id,
      conversationId: parsed.data.conversation_id,
      agentId: parsed.data.agent_id,
      message: parsed.data.message,
      metadata: parsed.data.metadata
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown chat error" },
      { status: 500 }
    );
  }
}
