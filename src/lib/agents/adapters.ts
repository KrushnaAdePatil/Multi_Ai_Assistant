import { DEFINITION_BY_ID } from "./definitions";
import type {
  AgentCallResult,
  ResolvedAgentConfig,
  TokenUsage,
} from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/* ------------------------------------------------------------------ */
/* Cost accounting                                                      */
/* ------------------------------------------------------------------ */

export function computeCostUsd(
  agentId: string,
  usage: TokenUsage,
): number {
  const pricing = DEFINITION_BY_ID.get(agentId)?.pricing;
  if (!pricing) return 0;
  return (
    (usage.promptTokens * pricing.input +
      usage.completionTokens * pricing.output) /
    1_000_000
  );
}

/* ------------------------------------------------------------------ */
/* Error normalization                                                  */
/* ------------------------------------------------------------------ */

function humanizeError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return `Timed out after ${Math.round(timeoutMs / 1000)}s`;
    }
    const msg = err.message || "Unknown error";
    if (/401|unauthorized|invalid api key|incorrect api key/i.test(msg))
      return "Invalid API key (401)";
    if (/403|forbidden/i.test(msg)) return "Access forbidden (403)";
    if (/404|not found/i.test(msg)) return "Endpoint not found (404)";
    if (/429|rate limit|quota/i.test(msg)) return "Rate limited (429)";
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg))
      return "Host unreachable — check base URL";
    if (/ECONNREFUSED/i.test(msg)) return "Connection refused — is it running?";
    if (/fetch failed/i.test(msg)) return "Network request failed";
    return msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
  }
  return "Unknown error";
}

/* ------------------------------------------------------------------ */
/* Provider HTTP calls — each returns { content, usage }               */
/* ------------------------------------------------------------------ */

interface ProviderOutput {
  content: string;
  usage: TokenUsage;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof json.error === "string") return json.error;
      if (json.error?.message) return json.error.message;
      if (json.message) return json.message;
      return text.slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function callOpenAICompatible(
  cfg: ResolvedAgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderOutput> {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
    }),
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  // Some providers return content parts; DeepSeek/OpenAI return a string.
  const raw = data.choices?.[0]?.message?.content;
  const content =
    typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  const u = data.usage;
  return {
    content,
    usage: {
      promptTokens: u?.prompt_tokens ?? 0,
      completionTokens: u?.completion_tokens ?? 0,
      totalTokens: u?.total_tokens ?? 0,
    },
  };
}

async function callAzure(
  cfg: ResolvedAgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderOutput> {
  const deployment = cfg.model || "gpt-4o";
  const url = `${cfg.baseUrl.replace(
    /\/+$/,
    "",
  )}/openai/deployments/${encodeURIComponent(
    deployment,
  )}/chat/completions?api-version=2024-10-21`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "api-key": cfg.apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
    }),
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const u = data.usage;
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage: {
      promptTokens: u?.prompt_tokens ?? 0,
      completionTokens: u?.completion_tokens ?? 0,
      totalTokens: u?.total_tokens ?? 0,
    },
  };
}

async function callGemini(
  cfg: ResolvedAgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderOutput> {
  const model = cfg.model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  const system = messages.find((m) => m.role === "system")?.content;
  const chat = messages.filter((m) => m.role !== "system");
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cfg.apiKey,
    },
    body: JSON.stringify({
      ...(system
        ? { systemInstruction: { parts: [{ text: system }] } }
        : undefined),
      contents: chat.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxTokens,
      },
    }),
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? "";
  const u = data.usageMetadata;
  return {
    content,
    usage: {
      promptTokens: u?.promptTokenCount ?? 0,
      completionTokens: u?.candidatesTokenCount ?? 0,
      totalTokens: u?.totalTokenCount ?? 0,
    },
  };
}

async function callAnthropic(
  cfg: ResolvedAgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderOutput> {
  const system = messages.find((m) => m.role === "system")?.content;
  const chat = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: Math.max(1, cfg.maxTokens),
      temperature: cfg.temperature,
      ...(system ? { system } : undefined),
      messages: chat.length ? chat : [{ role: "user", content: "" }],
    }),
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content =
    data.content?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("") ?? "";
  const input = data.usage?.input_tokens ?? 0;
  const output = data.usage?.output_tokens ?? 0;
  return {
    content,
    usage: {
      promptTokens: input,
      completionTokens: output,
      totalTokens: input + output,
    },
  };
}

async function callOllama(
  cfg: ResolvedAgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderOutput> {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
      options: {
        temperature: cfg.temperature,
        num_predict: cfg.maxTokens,
      },
    }),
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = (await res.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const input = data.prompt_eval_count ?? 0;
  const output = data.eval_count ?? 0;
  return {
    content: data.message?.content ?? "",
    usage: {
      promptTokens: input,
      completionTokens: output,
      totalTokens: input + output,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                           */
/* ------------------------------------------------------------------ */

const providerFns = {
  "openai-compatible": callOpenAICompatible,
  google: callGemini,
  anthropic: callAnthropic,
  azure: callAzure,
  ollama: callOllama,
} as const;

/** True when an agent has everything it needs to be called. */
export function isRunnable(cfg: ResolvedAgentConfig): boolean {
  if (!cfg.enabled) return false;
  if (cfg.requiresKey && !cfg.apiKey) return false;
  if (cfg.provider !== "google" && !cfg.baseUrl) return false;
  return true;
}

/**
 * Call a single agent with the given chat messages. Never throws — failures
 * return a normalized, humanized error result so the ensemble keeps going.
 */
export async function callAgent(
  cfg: ResolvedAgentConfig,
  messages: ChatMessage[],
): Promise<AgentCallResult> {
  const started = Date.now();
  const fail = (error: string): AgentCallResult => ({
    agentId: cfg.id,
    agentName: cfg.displayName,
    model: cfg.model,
    content: "",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    costUsd: 0,
    latencyMs: Date.now() - started,
    success: false,
    error,
  });

  if (cfg.requiresKey && !cfg.apiKey) return fail("No API key configured");
  if (cfg.provider !== "google" && !cfg.baseUrl)
    return fail("No base URL configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const fn = providerFns[cfg.provider] ?? callOpenAICompatible;
    const out = await fn(cfg, messages, controller.signal);
    if (!out.content.trim()) return fail("Empty response from model");
    return {
      agentId: cfg.id,
      agentName: cfg.displayName,
      model: cfg.model,
      content: out.content.trim(),
      usage: out.usage,
      costUsd: computeCostUsd(cfg.id, out.usage),
      latencyMs: Date.now() - started,
      success: true,
    };
  } catch (err) {
    return fail(humanizeError(err, cfg.timeoutMs));
  } finally {
    clearTimeout(timer);
  }
}

/** Fire every agent in parallel. Callbacks fire in completion order. */
export async function fanOutAll(
  agents: ResolvedAgentConfig[],
  messages: ChatMessage[],
  onEach?: (result: AgentCallResult, cfg: ResolvedAgentConfig) => void,
): Promise<AgentCallResult[]> {
  const results: AgentCallResult[] = [];
  await Promise.all(
    agents.map(async (cfg) => {
      const result = await callAgent(cfg, messages);
      results.push(result);
      onEach?.(result, cfg);
    }),
  );
  return results;
}
