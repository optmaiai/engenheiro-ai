import { describe, expect, it } from "vitest";
import { createAgentPromptSchema, ingestAttachmentSchema, updateAgentPromptSchema } from "../../src/lib/schemas";

describe("request schemas", () => {
  it("rejects attachment overlap greater than chunk size", () => {
    const result = ingestAttachmentSchema.safeParse({
      filename: "a.txt",
      content: "texto",
      chunk_size: 500,
      overlap: 500
    });

    expect(result.success).toBe(false);
  });

  it("requires prompt content with operational length", () => {
    const result = createAgentPromptSchema.safeParse({
      agent_id: "orcamento",
      title: "Curto",
      content: "muito curto"
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty prompt updates", () => {
    const result = updateAgentPromptSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
