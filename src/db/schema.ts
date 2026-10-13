import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/**
 * Per-agent configuration. Seeded from environment variables on first boot,
 * then fully editable from the Settings panel. Effective credentials resolve
 * as: DB override → environment variable → unconfigured.
 */
export const agentConfigs = pgTable("agent_configs", {
  id: text("id").primaryKey(), // e.g. "deepseek"
  displayName: text("display_name").notNull(),
  provider: text("provider").notNull(), // openai-compatible | google | anthropic | azure | ollama
  enabled: boolean("enabled").notNull().default(false),
  apiKey: text("api_key"), // nullable → fall back to env var
  baseUrl: text("base_url"),
  model: text("model").notNull().default(""),
  temperature: doublePrecision("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(2048),
  timeoutMs: integer("timeout_ms").notNull().default(30000),
  accent: text("accent").notNull().default("#22d3ee"), // UI accent color
  glyph: text("glyph").notNull().default("sparkles"), // lucide icon id
  isCore: boolean("is_core").notNull().default(true), // core vs optional roster
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Simple key/value store for global app settings (synthesizer, etc). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** One row per orchestration run (a query fanned out to all agents). */
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: text("query").notNull(),
    synthesis: text("synthesis"),
    synthesizerId: text("synthesizer_id"),
    status: text("status").notNull().default("running"), // running | completed | partial | failed
    agentsUsed: integer("agents_used").notNull().default(0),
    agentsSucceeded: integer("agents_succeeded").notNull().default(0),
    totalLatencyMs: integer("total_latency_ms").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    totalCostUsd: doublePrecision("total_cost_usd").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("runs_created_at_idx").on(t.createdAt)],
);

/** One row per agent response inside a run. */
export const runResponses = pgTable(
  "run_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    agentName: text("agent_name").notNull(),
    model: text("model").notNull().default(""),
    role: text("role").notNull().default("agent"), // agent | synthesizer
    content: text("content").notNull().default(""),
    latencyMs: integer("latency_ms").notNull().default(0),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    success: boolean("success").notNull().default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("run_responses_run_id_idx").on(t.runId)],
);

export type AgentConfig = typeof agentConfigs.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunResponse = typeof runResponses.$inferSelect;
