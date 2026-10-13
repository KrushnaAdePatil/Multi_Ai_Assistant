import { db } from "@/db";
import { agentConfigs, appSettings } from "@/db/schema";
import {
  AGENT_DEFINITIONS,
  DEFINITION_BY_ID,
  isPlaceholderKey,
  type AgentDefinition,
} from "@/lib/agents/definitions";
import type { ProviderId, ResolvedAgentConfig } from "@/lib/agents/types";
import { asc, eq } from "drizzle-orm";

let seedPromise: Promise<void> | null = null;

function envBool(name: string | undefined, fallback: boolean): boolean {
  const raw = name ? process.env[name] : undefined;
  if (raw === undefined || raw === "") return fallback;
  return raw.trim().toLowerCase() === "true";
}

function envStr(name: string | undefined): string | undefined {
  const raw = name ? process.env[name] : undefined;
  return raw && raw.trim() !== "" ? raw.trim() : undefined;
}

/** Seeds agent_configs rows from env defaults on first boot (idempotent). */
async function seedAgents(): Promise<void> {
  const existing = await db
    .select({ id: agentConfigs.id })
    .from(agentConfigs);
  if (existing.length > 0) return;

  await db.insert(agentConfigs).values(
    AGENT_DEFINITIONS.map((d) => ({
      id: d.id,
      displayName: d.displayName,
      provider: d.provider,
      enabled: envBool(d.env.enabled, d.isCore),
      apiKey: null,
      baseUrl: envStr(d.env.baseUrl) ?? d.defaults.baseUrl ?? "",
      model: envStr(d.env.model) ?? d.defaults.model,
      temperature: d.defaults.temperature,
      maxTokens: d.defaults.maxTokens,
      timeoutMs: d.defaults.timeoutMs,
      accent: d.accent,
      glyph: d.glyph,
      isCore: d.isCore,
      sortOrder: d.sortOrder,
    })),
  );
}

export async function ensureSeeded(): Promise<void> {
  seedPromise ??= seedAgents().catch((e) => {
    seedPromise = null;
    throw e;
  });
  return seedPromise;
}

export interface SanitizedAgent {
  id: string;
  displayName: string;
  provider: ProviderId;
  enabled: boolean;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  accent: string;
  glyph: string;
  isCore: boolean;
  requiresKey: boolean;
  keySource: "db" | "env" | "none";
  keyPreview: string | null; // "••••4d2f"
  pricing: { input: number; output: number };
}

interface AgentRow {
  id: string;
  displayName: string;
  provider: string;
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  accent: string;
  glyph: string;
  isCore: boolean;
  sortOrder: number;
}

function resolveKey(
  def: AgentDefinition,
  dbKey: string | null,
): { key: string; source: "db" | "env" | "none" } {
  if (!isPlaceholderKey(dbKey)) return { key: dbKey!.trim(), source: "db" };
  const envKey = envStr(def.env.apiKey);
  if (!isPlaceholderKey(envKey)) return { key: envKey!, source: "env" };
  return { key: "", source: "none" };
}

function toResolved(row: AgentRow): ResolvedAgentConfig {
  const def = DEFINITION_BY_ID.get(row.id);
  const { key, source } = def
    ? resolveKey(def, row.apiKey)
    : { key: "", source: "none" as const };
  return {
    id: row.id,
    displayName: row.displayName,
    provider: row.provider as ProviderId,
    enabled: row.enabled,
    apiKey: key,
    baseUrl: row.baseUrl ?? def?.defaults.baseUrl ?? "",
    model: row.model,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    timeoutMs: row.timeoutMs,
    accent: row.accent,
    glyph: row.glyph,
    isCore: row.isCore,
    keySource: source,
    requiresKey: def?.requiresKey ?? true,
  };
}

export async function getResolvedAgents(): Promise<ResolvedAgentConfig[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(agentConfigs)
    .orderBy(asc(agentConfigs.sortOrder));
  return rows.map(toResolved);
}

export async function getSanitizedAgents(): Promise<SanitizedAgent[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(agentConfigs)
    .orderBy(asc(agentConfigs.sortOrder));
  return rows.map((row) => {
    const def = DEFINITION_BY_ID.get(row.id);
    const resolved = toResolved(row as AgentRow);
    const masked =
      resolved.keySource === "none"
        ? null
        : `••••${resolved.apiKey.slice(-4) || "????"}`;
    return {
      id: resolved.id,
      displayName: resolved.displayName,
      provider: resolved.provider,
      enabled: resolved.enabled,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
      temperature: resolved.temperature,
      maxTokens: resolved.maxTokens,
      timeoutMs: resolved.timeoutMs,
      accent: resolved.accent,
      glyph: resolved.glyph,
      isCore: resolved.isCore,
      requiresKey: resolved.requiresKey,
      keySource: resolved.keySource,
      keyPreview: masked,
      pricing: def?.pricing ?? { input: 0, output: 0 },
    };
  });
}

export async function getSynthesizerId(): Promise<string> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "synthesizer"))
    .limit(1);
  if (rows[0]?.value) return rows[0].value;
  return envStr("SYNTHESIZER_AI") ?? "deepseek";
}

export async function setSynthesizerId(id: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "synthesizer", value: id })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: id },
    });
}
