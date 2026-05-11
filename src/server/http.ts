export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Corpo da requisição precisa ser um JSON válido.");
  }
}

export function getAllowedAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "adminmaster@engenheiro.ai")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAllowedAdminEmails().includes(email.toLowerCase());
}
