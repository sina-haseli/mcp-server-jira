import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { ToolResult, fail, ok } from "../jira/errors";

export const PRIORITY_VALUES = [
  "Highest",
  "High",
  "Medium",
  "Low",
  "Lowest",
] as const;

export type Priority = (typeof PRIORITY_VALUES)[number];

/**
 * MCP tool behavior hints. These are advisory: the host (e.g. Claude) uses them
 * to decide whether to surface a confirmation prompt to the human. They do NOT
 * enforce anything server-side — for that we also use {@link needsConfirmation}.
 */
export interface ToolAnnotations {
  title?: string;
  /** Tool does not modify state. */
  readOnlyHint?: boolean;
  /** Tool may perform destructive/irreversible updates (e.g. delete). */
  destructiveHint?: boolean;
  /** Repeated calls with the same args have no additional effect. */
  idempotentHint?: boolean;
  /** Tool interacts with an external/open system (always true here — Jira). */
  openWorldHint?: boolean;
}

/**
 * Thin wrapper around `server.tool` that also passes annotations.
 *
 * The SDK's per-property generic inference (ShapeOutput) exceeds TypeScript's
 * recursion limit (TS2589) on larger schemas, and once the compiler's recursion
 * budget is exhausted it cascades to other registrations too. Binding through a
 * widened signature stops the deep inference. Each handler restores precise
 * input typing via its own args interface + cast.
 */
export function registerTool(
  server: McpServer,
  name: string,
  description: string,
  shape: z.ZodRawShape,
  annotations: ToolAnnotations,
  cb: (args: Record<string, unknown>) => Promise<ToolResult>
): void {
  const register = server.tool.bind(server) as unknown as (
    name: string,
    description: string,
    shape: z.ZodRawShape,
    annotations: ToolAnnotations,
    cb: (args: Record<string, unknown>) => Promise<ToolResult>
  ) => unknown;

  register(name, description, shape, annotations, cb);
}

/**
 * Server-side, client-agnostic guard for risky actions. If the caller did not
 * pass `confirm: true`, returns a (non-error) result describing the impact and
 * instructing the agent to re-call with confirmation. Returns `null` when the
 * action is confirmed and may proceed.
 */
export function needsConfirmation(
  confirmed: boolean | undefined,
  impact: string
): ToolResult | null {
  if (confirmed === true) return null;
  return ok({
    requires_confirmation: true,
    warning: impact,
    how_to_proceed:
      "This action is irreversible or high-impact. Re-call this tool with confirm:true to proceed.",
  });
}

/** Reusable Zod field for the confirmation flag on guarded tools. */
export const confirmField = z
  .boolean()
  .optional()
  .describe(
    "Must be set to true to actually perform this irreversible/high-impact action. If omitted, the tool returns a warning instead of acting."
  );

/** Reusable Zod field for the optional per-call project override. */
export const projectKeyField = z
  .string()
  .optional()
  .describe(
    "Project key to target (e.g. \"PRD\"). Defaults to the configured JIRA_PROJECT_KEY if omitted."
  );

/**
 * Resolve the effective project key: per-call argument first, then the
 * configured default. Returns `{ key }` on success, or `{ error }` (a ready
 * ToolResult) when neither is available.
 */
export function resolveProject(
  argKey: string | undefined
): { key: string } | { error: ToolResult } {
  const key = argKey?.trim() || config.projectKey;
  if (!key) {
    return {
      error: fail({
        error: true,
        message:
          "No project specified and no default project configured. Pass project_key, or set JIRA_PROJECT_KEY / projectKey in the config.",
      }),
    };
  }
  return { key };
}
