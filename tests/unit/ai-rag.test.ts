import { describe, expect, it } from "vitest";
import { chunkText, estimateEmbeddingTokens, formatChunksForPrompt, rankChunksForQuery } from "../../src/server/ai-rag";

describe("RAG helpers", () => {
  it("chunks text with overlap and stable indexes", () => {
    const chunks = chunkText("abcdefghijklmnopqrstuvwxyz", 10, 3);

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toMatchObject({ chunk_index: 0, content: "abcdefghij", char_start: 0, char_end: 10 });
    expect(chunks[1].content.startsWith("hij")).toBe(true);
  });

  it("estimates embedding tokens conservatively", () => {
    expect(estimateEmbeddingTokens("12345678")).toBe(2);
  });

  it("ranks chunks by query term matches", () => {
    const ranked = rankChunksForQuery(
      [
        { content: "carga de vento na cobertura", chunk_index: 2 },
        { content: "cronograma financeiro", chunk_index: 1 }
      ],
      "vento cobertura",
      3
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].chunk_index).toBe(2);
    expect(ranked[0].score).toBe(2);
  });

  it("formats chunks for SYS-6 prompt context", () => {
    const formatted = formatChunksForPrompt([
      { filename: "memorial.txt", page_number: 4, chunk_index: 1, content: "Trecho técnico" }
    ]);

    expect(formatted).toContain("[Anexo 1: memorial.txt · p.4 · chunk 1]");
    expect(formatted).toContain("Trecho técnico");
  });
});
