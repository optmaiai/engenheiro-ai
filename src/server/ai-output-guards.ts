/**
 * Output Guardrails — 7-layer post-LLM validation pipeline
 * Executa após LLM responde, antes de persistir
 */

import { z } from "zod";
import { recordGuardrailTriggered } from "./ai-metrics";

export interface GuardrailResult {
  passed: boolean;
  guardrails_triggered: Array<{
    name: string;
    action: string;
    severity: "info" | "warning" | "error";
    original_content?: string;
    sanitized_content?: string;
  }>;
  sanitized_content: string;
  retry_needed: boolean;
  retry_reason?: string;
}

// ========================================================================
// GUARDRAIL 1: PII MASKING
// ========================================================================

function maskPII(content: string): string {
  // CPF: 123.456.789-10 → ***.***.***.** 
  content = content.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "***.***.***-**");

  // CNPJ: 12.345.678/0001-90 → **.***.***/****-**
  content = content.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "**.***.***/****-**");

  // Números de conta (padrão: 5-10 dígitos após "conta")
  content = content.replace(/(conta\s*:?\s*)\d{5,10}/gi, "$1[CONTA_OCULTA]");

  // Agência (padrão: 4 dígitos após "agência")
  content = content.replace(/(agência\s*:?\s*)\d{4}/gi, "$1[AGENCIA_OCULTA]");

  return content;
}

export function guardrailPIIMasking(
  content: string
): { passed: boolean; action?: string; sanitized?: string } {
  const masked = maskPII(content);

  if (masked !== content) {
    return {
      passed: true,
      action: "pii_masked",
      sanitized: masked,
    };
  }

  return { passed: true };
}

// ========================================================================
// GUARDRAIL 2: SECRET DETECTION
// ========================================================================

const SECRET_PATTERNS = [
  // API Keys
  { label: "openai_key", regex: /sk-[A-Za-z0-9]{20,}/gi },
  { label: "aws_key", regex: /AKIA[0-9A-Z]{16}/gi },
  { label: "github_token", regex: /ghp_[A-Za-z0-9_]{36,}/gi },
  // JWT / Tokens
  {
    label: "jwt_token",
    regex: /eyJhbGciOi[A-Za-z0-9_-]{50,}/gi,
  },
  // Database URLs
  {
    label: "database_url",
    regex: /(postgres|mysql|mongodb):\/\/[^\s"]+/gi,
  },
  // Private Keys
  { label: "rsa_key", regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/gi },
];

export function guardrailSecretDetection(
  content: string
): { passed: boolean; secrets_found?: string[]; action?: string } {
  const foundSecrets: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(content)) {
      foundSecrets.push(pattern.label);
      pattern.regex.lastIndex = 0; // Reset regex state
    }
  }

  if (foundSecrets.length > 0) {
    return {
      passed: false,
      secrets_found: foundSecrets,
      action: "blocked_secret_detected",
    };
  }

  return { passed: true };
}

// ========================================================================
// GUARDRAIL 3: CREDIT CARD DETECTION (Luhn Algorithm)
// ========================================================================

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

export function guardrailCreditCardDetection(
  content: string
): { passed: boolean; cards_detected?: number; action?: string } {
  // Pattern: 13-19 digits (with or without spaces/dashes)
  const cardPattern = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
  const matches = content.match(cardPattern) || [];

  let validCards = 0;
  for (const match of matches) {
    const digits = match.replace(/\D/g, "");
    if (luhnCheck(digits)) {
      validCards++;
    }
  }

  if (validCards > 0) {
    return {
      passed: false,
      cards_detected: validCards,
      action: "blocked_credit_card",
    };
  }

  return { passed: true };
}

// ========================================================================
// GUARDRAIL 4: RESPONSE LENGTH CHECK
// ========================================================================

export function guardrailResponseLength(
  content: string,
  agentId: string,
  minChars: number = 30
): { passed: boolean; action?: string; retry_needed?: boolean } {
  // Technical agents need minimum content
  const technicalAgents = [
    "orcamento",
    "admin_financeiro",
    "normas",
    "senior",
    "planejamento",
  ];

  if (
    technicalAgents.includes(agentId) &&
    content.trim().length < minChars
  ) {
    return {
      passed: false,
      action: "response_too_short",
      retry_needed: true,
    };
  }

  return { passed: true };
}

// ========================================================================
// GUARDRAIL 5: DISCLAIMER OBRIGATÓRIO
// ========================================================================

const REQUIRED_DISCLAIMERS: Record<string, string> = {
  orcamento: `\n\n---\n*Esta análise de orçamento é orientativa. Validação técnica e contratual por profissional habilitado é obrigatória.*`,
  admin_financeiro: `\n\n---\n*Esta análise financeira é orientativa. Validação por contador e profissional habilitado é obrigatória.*`,
  normas: `\n\n---\n*Análise normativa orientativa. Validação por engenheiro habilitado e assessoria jurídica é obrigatória.*`,
  senior: `\n\n---\n*Recomendações de consultoria orientativas. Decisão final cabe ao profissional habilitado responsável.*`,
};

export function guardrailDisclaimerRequired(
  content: string,
  agentId: string
): { passed: boolean; action?: string; appended?: string } {
  const disclaimer = REQUIRED_DISCLAIMERS[agentId];
  if (!disclaimer) {
    return { passed: true };
  }

  if (!content.includes(disclaimer.trim())) {
    return {
      passed: true,
      action: "disclaimer_appended",
      appended: content + disclaimer,
    };
  }

  return { passed: true };
}


function extractFirstJsonObject(content: string): string | null {
  const firstBrace = content.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < content.length; i++) {
    const char = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) return content.slice(firstBrace, i + 1);
  }

  return null;
}

// ========================================================================
// GUARDRAIL 6: JSON VALIDATION
// ========================================================================

export async function guardrailJsonValidation(
  content: string,
  schema: z.ZodSchema
): Promise<{
  passed: boolean;
  action?: string;
  validated_data?: unknown;
  retry_needed?: boolean;
}> {
  // Tentar extrair o primeiro objeto JSON balanceado do content
  const jsonCandidate = extractFirstJsonObject(content);
  if (!jsonCandidate) {
    return {
      passed: false,
      action: "json_not_found",
      retry_needed: true,
    };
  }

  try {
    const parsed = JSON.parse(jsonCandidate);
    const validated = schema.parse(parsed);
    return {
      passed: true,
      action: "json_validated",
      validated_data: validated,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        passed: false,
        action: "json_validation_failed",
        retry_needed: true,
      };
    }

    if (err instanceof SyntaxError) {
      return {
        passed: false,
        action: "json_parse_error",
        retry_needed: true,
      };
    }

    return {
      passed: false,
      action: "json_unknown_error",
      retry_needed: false,
    };
  }
}

// ========================================================================
// GUARDRAIL 7: ROUTING FORMAT
// ========================================================================

const ROUTING_REGEX = /ROUTING:\s*\{[\s\S]*?\}/;

export function guardrailRoutingFormat(
  content: string
): {
  passed: boolean;
  action?: string;
  appended?: string;
  routing_json?: string;
} {
  const match = content.match(ROUTING_REGEX);

  if (match) {
    return {
      passed: true,
      action: "routing_found",
      routing_json: match[0],
    };
  }

  // Routing não encontrado — append default
  const defaultRouting = `\n\nROUTING: {"handoff_to":[],"reason":"Análise concluída","confidence":1.0}`;

  return {
    passed: true,
    action: "routing_appended_default",
    appended: content + defaultRouting,
  };
}

// ========================================================================
// MAIN PIPELINE: Executar todos guardrails em sequência
// ========================================================================

export async function executeGuardrailsPipeline(
  content: string,
  agentId: string,
  schema?: z.ZodSchema,
  conversationId?: string,
  userId?: string
): Promise<GuardrailResult> {
  const triggered: GuardrailResult["guardrails_triggered"] = [];
  let processedContent = content;
  let retryNeeded = false;

  // G1: PII Masking
  const g1 = guardrailPIIMasking(processedContent);
  if (g1.sanitized) {
    triggered.push({
      name: "pii_masking",
      action: g1.action || "applied",
      severity: "info",
      original_content: processedContent,
      sanitized_content: g1.sanitized,
    });
    processedContent = g1.sanitized;
  }

  // G2: Secret Detection
  const g2 = guardrailSecretDetection(processedContent);
  if (!g2.passed) {
    triggered.push({
      name: "secret_detection",
      action: g2.action || "blocked",
      severity: "error",
    });

    if (userId && conversationId) {
      await recordGuardrailTriggered(
        conversationId,
        userId,
        "secret_detection",
        "blocked",
        agentId
      );
    }

    return {
      passed: false,
      guardrails_triggered: triggered,
      sanitized_content: processedContent,
      retry_needed: false,
    };
  }

  // G3: Credit Card Detection
  const g3 = guardrailCreditCardDetection(processedContent);
  if (!g3.passed) {
    triggered.push({
      name: "credit_card_detection",
      action: g3.action || "blocked",
      severity: "error",
    });

    if (userId && conversationId) {
      await recordGuardrailTriggered(
        conversationId,
        userId,
        "credit_card_detection",
        "blocked",
        agentId
      );
    }

    return {
      passed: false,
      guardrails_triggered: triggered,
      sanitized_content: processedContent,
      retry_needed: false,
    };
  }

  // G4: Response Length
  const g4 = guardrailResponseLength(processedContent, agentId);
  if (!g4.passed) {
    triggered.push({
      name: "response_length",
      action: g4.action || "too_short",
      severity: "warning",
    });
    retryNeeded = g4.retry_needed || false;
  }

  // G5: Disclaimer
  const g5 = guardrailDisclaimerRequired(processedContent, agentId);
  if (g5.appended) {
    triggered.push({
      name: "disclaimer_required",
      action: g5.action || "appended",
      severity: "info",
    });
    processedContent = g5.appended;
  }

  // G6: JSON Validation (se schema fornecido)
  if (schema) {
    const g6 = await guardrailJsonValidation(processedContent, schema);
    if (!g6.passed) {
      triggered.push({
        name: "json_validation",
        action: g6.action || "invalid",
        severity: "warning",
      });
      retryNeeded = g6.retry_needed || false;
    }
  }

  // G7: Routing Format
  const g7 = guardrailRoutingFormat(processedContent);
  if (g7.appended) {
    triggered.push({
      name: "routing_format",
      action: g7.action || "appended",
      severity: "info",
    });
    processedContent = g7.appended;
  }

  // Log all guardrails triggered
  if (userId && conversationId && triggered.length > 0) {
    for (const guard of triggered) {
      if (guard.severity !== "info") {
        await recordGuardrailTriggered(
          conversationId,
          userId,
          guard.name,
          guard.action,
          agentId
        );
      }
    }
  }

  return {
    passed: triggered.every(
      (g) => g.severity !== "error"
    ),
    guardrails_triggered: triggered,
    sanitized_content: processedContent,
    retry_needed:
      retryNeeded &&
      triggered.some((g) => g.severity === "warning"),
  };
}
