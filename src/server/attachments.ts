import { createServiceClient } from "./supabase";

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureConversationOwner(
  conversationId: string,
  userId: string,
  supabase = createServiceClient()
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function ensureAttachmentOwner(
  attachmentId: string,
  userId: string,
  supabase = createServiceClient()
) {
  const { data, error } = await supabase
    .from("attachments")
    .select("id,conversation_id,filename,file_type,file_size_bytes,chunks_count,created_at,conversations!inner(user_id)")
    .eq("id", attachmentId)
    .eq("conversations.user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
