import { NextResponse } from "next/server";
import { searchAttachmentChunksSchema } from "@/lib/schemas";
import { ensureAttachmentOwner, isUuid } from "@/server/attachments";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

interface RouteContext {
  params: Promise<{ attachmentId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { attachmentId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(attachmentId)) return NextResponse.json({ error: "attachmentId inválido" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const parsed = searchAttachmentChunksSchema.safeParse({
    q: searchParams.get("q") || "",
    limit: Number(searchParams.get("limit") || "6")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const attachment = await ensureAttachmentOwner(attachmentId, user.id, supabase);
  if (!attachment) return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });

  const terms = parsed.data.q
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 8);

  const { data, error } = await supabase
    .from("attachment_chunks")
    .select("id,chunk_index,content,page_number,char_start,char_end,created_at")
    .eq("attachment_id", attachmentId)
    .order("chunk_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ranked = (data || [])
    .map((chunk) => {
      const lowerContent = String(chunk.content || "").toLowerCase();
      const score = terms.reduce((sum, term) => sum + (lowerContent.includes(term) ? 1 : 0), 0);
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)
    .slice(0, parsed.data.limit);

  return NextResponse.json({ attachment, chunks: ranked, query: parsed.data.q });
}
