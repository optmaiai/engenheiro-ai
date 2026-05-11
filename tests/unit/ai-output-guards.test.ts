import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  executeGuardrailsPipeline,
  guardrailCreditCardDetection,
  guardrailDisclaimerRequired,
  guardrailJsonValidation,
  guardrailPIIMasking,
  guardrailRoutingFormat,
  guardrailSecretDetection
} from "../../src/server/ai-output-guards";

describe("output guardrails", () => {
  it("masks Brazilian CPF, CNPJ and bank account identifiers", () => {
    const result = guardrailPIIMasking(
      "CPF 123.456.789-10 CNPJ 12.345.678/0001-90 conta 123456 agência 1234"
    );

    expect(result.passed).toBe(true);
    expect(result.sanitized).toContain("***.***.***-**");
    expect(result.sanitized).toContain("**.***.***/****-**");
    expect(result.sanitized).toContain("conta [CONTA_OCULTA]");
    expect(result.sanitized).toContain("agência [AGENCIA_OCULTA]");
  });

  it("blocks common secrets", () => {
    const result = guardrailSecretDetection("token sk-123456789012345678901234567890");

    expect(result.passed).toBe(false);
    expect(result.secrets_found).toContain("openai_key");
  });

  it("detects Luhn-valid card numbers across 13-19 digit formats", () => {
    const result = guardrailCreditCardDetection("cartão 4111-1111-1111-1111");

    expect(result.passed).toBe(false);
    expect(result.cards_detected).toBe(1);
  });

  it("does not flag arbitrary long numeric strings as cards when Luhn fails", () => {
    const result = guardrailCreditCardDetection("protocolo 1234-5678-9012-3456");

    expect(result.passed).toBe(true);
  });

  it("appends the exact disclaimer only when missing", () => {
    const first = guardrailDisclaimerRequired("Análise técnica", "senior");
    expect(first.appended).toContain("Recomendações de consultoria orientativas");

    const second = guardrailDisclaimerRequired(first.appended!, "senior");
    expect(second.appended).toBeUndefined();
  });

  it("validates the first balanced JSON object without swallowing routing JSON", async () => {
    const schema = z.object({ ok: z.boolean() });
    const result = await guardrailJsonValidation(
      'Resposta {"ok":true}\n\nROUTING: {"handoff_to":[],"reason":"fim","confidence":1}',
      schema
    );

    expect(result.passed).toBe(true);
    expect(result.validated_data).toEqual({ ok: true });
  });

  it("appends default routing when missing", () => {
    const result = guardrailRoutingFormat("Resposta sem roteamento");

    expect(result.appended).toContain('ROUTING: {"handoff_to":[]');
  });

  it("runs the pipeline with PII masking, disclaimer and routing normalization", async () => {
    const result = await executeGuardrailsPipeline(
      "CPF 123.456.789-10. Diagnóstico técnico suficientemente detalhado para o usuário.",
      "senior"
    );

    expect(result.passed).toBe(true);
    expect(result.sanitized_content).toContain("***.***.***-**");
    expect(result.sanitized_content).toContain("Recomendações de consultoria orientativas");
    expect(result.sanitized_content).toContain("ROUTING:");
  });
});
