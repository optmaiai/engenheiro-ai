interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface CompletionResult {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export async function createCompletion(messages: ChatMessage[], model: string): Promise<CompletionResult> {
  const apiKey = process.env.LOVABLE_AI_KEY;
  const endpoint = process.env.LOVABLE_AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";

  if (!apiKey) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    return {
      content: `Modo demonstração: recebi sua solicitação e estruturaria a resposta técnica com premissas, riscos, próximos passos e validações necessárias.\n\nResumo do pedido: ${lastUserMessage.slice(0, 500)}\n\nROUTING: {"handoff_to":[],"reason":"Resposta demonstrativa sem LOVABLE_AI_KEY configurada","confidence":0.6}`,
      model: `${model}:demo`,
      tokensIn: messages.reduce((sum, message) => sum + Math.ceil(message.content.length / 4), 0),
      tokensOut: 120,
      costUsd: 0
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Lovable AI Gateway error ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: CompletionUsage;
    model?: string;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Lovable AI Gateway returned an empty completion");

  return {
    content,
    model: data.model || model,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
    costUsd: 0
  };
}
