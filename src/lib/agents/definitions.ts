import type { ProviderId } from "./types";

export interface AgentDefinition {
  id: string;
  displayName: string;
  provider: ProviderId;
  accent: string;
  glyph: string;
  isCore: boolean;
  sortOrder: number;
  requiresKey: boolean;
  defaults: {
    model: string;
    baseUrl?: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
  env: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    enabled?: string;
  };
  /** USD per 1M tokens. */
  pricing: { input: number; output: number };
}

/**
 * The full 7-agent roster. 3 core models (armed by default) and 4 optional
 * ones that light up the moment keys are provided.
 */
export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "deepseek",
    displayName: "DeepSeek",
    provider: "openai-compatible",
    accent: "#22d3ee",
    glyph: "waves",
    isCore: true,
    sortOrder: 1,
    requiresKey: true,
    defaults: {
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
    },
    env: {
      apiKey: "DEEPSEEK_API_KEY",
      baseUrl: "DEEPSEEK_BASE_URL",
      model: "DEEPSEEK_MODEL",
      enabled: "DEEPSEEK_ENABLED",
    },
    pricing: { input: 0.14, output: 0.28 },
  },
  {
    id: "openai",
    displayName: "GPT-4o",
    provider: "openai-compatible",
    accent: "#34d399",
    glyph: "sparkles",
    isCore: true,
    sortOrder: 2,
    requiresKey: true,
    defaults: {
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
    },
    env: {
      apiKey: "OPENAI_API_KEY",
      baseUrl: "OPENAI_BASE_URL",
      model: "OPENAI_MODEL",
      enabled: "OPENAI_ENABLED",
    },
    pricing: { input: 2.5, output: 10 },
  },
  {
    id: "gemini",
    displayName: "Gemini",
    provider: "google",
    accent: "#818cf8",
    glyph: "gem",
    isCore: true,
    sortOrder: 3,
    requiresKey: true,
    defaults: {
      model: "gemini-1.5-flash",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
    },
    env: {
      apiKey: "GOOGLE_GEMINI_API_KEY",
      model: "GEMINI_MODEL",
      enabled: "GEMINI_ENABLED",
    },
    pricing: { input: 0.075, output: 0.3 },
  },
  {
    id: "claude",
    displayName: "Claude",
    provider: "anthropic",
    accent: "#f59e0b",
    glyph: "feather",
    isCore: false,
    sortOrder: 4,
    requiresKey: true,
    defaults: {
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
    },
    env: {
      apiKey: "ANTHROPIC_API_KEY",
      model: "CLAUDE_MODEL",
      enabled: "CLAUDE_ENABLED",
    },
    pricing: { input: 3, output: 15 },
  },
  {
    id: "perplexity",
    displayName: "Perplexity",
    provider: "openai-compatible",
    accent: "#2dd4bf",
    glyph: "compass",
    isCore: false,
    sortOrder: 5,
    requiresKey: true,
    defaults: {
      model: "llama-3.1-sonar-large-128k-online",
      baseUrl: "https://api.perplexity.ai",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 45000,
    },
    env: {
      apiKey: "PERPLEXITY_API_KEY",
      model: "PERPLEXITY_MODEL",
      enabled: "PERPLEXITY_ENABLED",
    },
    pricing: { input: 1, output: 1 },
  },
  {
    id: "copilot",
    displayName: "Copilot",
    provider: "azure",
    accent: "#60a5fa",
    glyph: "bot",
    isCore: false,
    sortOrder: 6,
    requiresKey: true,
    defaults: {
      model: "gpt-4o",
      baseUrl: "https://your-resource.openai.azure.com",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 30000,
    },
    env: {
      apiKey: "AZURE_OPENAI_KEY",
      baseUrl: "AZURE_OPENAI_ENDPOINT",
      model: "COPILOT_MODEL",
      enabled: "COPILOT_ENABLED",
    },
    pricing: { input: 2.5, output: 10 },
  },
  {
    id: "ollama",
    displayName: "Ollama",
    provider: "ollama",
    accent: "#f472b6",
    glyph: "terminal",
    isCore: false,
    sortOrder: 7,
    requiresKey: false,
    defaults: {
      model: "llama3",
      baseUrl: "http://localhost:11434",
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 60000,
    },
    env: {
      baseUrl: "OLLAMA_BASE_URL",
      model: "OLLAMA_MODEL",
      enabled: "OLLAMA_ENABLED",
    },
    pricing: { input: 0, output: 0 },
  },
];

export const DEFINITION_BY_ID = new Map(
  AGENT_DEFINITIONS.map((d) => [d.id, d]),
);

/** Placeholder keys like "your_deepseek_api_key_here" count as unconfigured. */
export function isPlaceholderKey(key: string | null | undefined): boolean {
  if (!key) return true;
  const k = key.trim().toLowerCase();
  return (
    k === "" ||
    k.startsWith("your_") ||
    k.includes("_here") ||
    k === "changeme" ||
    k === "none"
  );
}
