import { NextResponse } from "next/server";
import { ensureAttachmentOwner, isUuid } from "@/server/attachments";
import { createServiceClient, getAuthenticatedUser } from "@/server/supabase";

interface RouteContext {
  params: Promise<{ attachmentId: string }>;
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { attachmentId } = await params;
  const user = await getAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(attachmentId)) return NextResponse.json({ error: "attachmentId inválido" }, { status: 400 });

  const supabase = createServiceClient();
  const attachment = await ensureAttachmentOwner(attachmentId, user.id, supabase);
  if (!attachment) return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });

  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true, attachment });
}
