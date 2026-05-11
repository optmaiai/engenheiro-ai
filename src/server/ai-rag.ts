export interface TextChunk {
  chunk_index: number;
  content: string;
  char_start: number;
  char_end: number;
  page_number?: number;
}

export function chunkText(content: string, chunkSize = 1200, overlap = 180): TextChunk[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const slice = normalized.slice(start, end);
    chunks.push({
      chunk_index: chunks.length,
      content: slice,
      char_start: start,
      char_end: end
    });
    if (end === normalized.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export function estimateEmbeddingTokens(text: string): number {
  return Math.ceil(text.length / 4);
}


export function rankChunksForQuery<T extends { content: string; chunk_index?: number }>(
  chunks: T[],
  query: string,
  limit = 6
): Array<T & { score: number }> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4)
    .slice(0, 12);

  if (terms.length === 0) return [];

  return chunks
    .map((chunk) => {
      const content = chunk.content.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0);
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || (a.chunk_index || 0) - (b.chunk_index || 0))
    .slice(0, limit);
}

export function formatChunksForPrompt(
  chunks: Array<{ content: string; filename?: string; page_number?: number | null; chunk_index?: number }>
): string {
  if (chunks.length === 0) return "";

  return chunks
    .map((chunk, index) => {
      const source = [chunk.filename, chunk.page_number ? `p.${chunk.page_number}` : undefined, `chunk ${chunk.chunk_index ?? index}`]
        .filter(Boolean)
        .join(" · " );
      return `[Anexo ${index + 1}: ${source}]\n${chunk.content}`;
    })
    .join("\n\n");
}
