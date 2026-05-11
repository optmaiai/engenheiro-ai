import { NextResponse } from "next/server";
import { ingestAttachmentSchema } from "@/lib/schemas";
import { chunkText } from "@/server/ai-rag";
import { ensureConversationOwner, isUuid } from "@/server/attachments";
import { readJsonBody } from "@/server/http";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { conversationId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(conversationId)) return NextResponse.json({ error: "conversationId inválido" }, { status: 400 });

  const supabase = createServiceClient();
  const ownsConversation = await ensureConversationOwner(conversationId, user.id, supabase);
  if (!ownsConversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const { data, error } = await supabase
    .from("attachments")
    .select("id,filename,file_type,file_size_bytes,storage_path,extracted_pages,chunks_count,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachments: data || [] });
}

export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = ingestAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ownsConversation = await ensureConversationOwner(conversationId, user.id, supabase);
  if (!ownsConversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const chunks = chunkText(parsed.data.content, parsed.data.chunk_size, parsed.data.overlap).map((chunk) => ({
    ...chunk,
    page_number: parsed.data.page_number || chunk.page_number || null
  }));

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      conversation_id: conversationId,
      filename: parsed.data.filename,
      file_type: parsed.data.file_type,
      file_size_bytes: Buffer.byteLength(parsed.data.content, "utf8"),
      extracted_pages: parsed.data.page_number ? 1 : null,
      chunks_count: chunks.length
    })
    .select("id,filename,file_type,file_size_bytes,extracted_pages,chunks_count,created_at")
    .single();

  if (attachmentError) return NextResponse.json({ error: attachmentError.message }, { status: 500 });

  if (chunks.length > 0) {
    const { error: chunksError } = await supabase.from("attachment_chunks").insert(
      chunks.map((chunk) => ({
        attachment_id: attachment.id,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        page_number: chunk.page_number,
        char_start: chunk.char_start,
        char_end: chunk.char_end
      }))
    );

    if (chunksError) return NextResponse.json({ error: chunksError.message }, { status: 500 });
  }

  return NextResponse.json({ attachment, chunks_created: chunks.length }, { status: 201 });
}
