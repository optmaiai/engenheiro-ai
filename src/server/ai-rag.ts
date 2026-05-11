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
