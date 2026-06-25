import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { PRIORITY_VALUES, Priority, registerTool } from "./shared";

interface UpdateStoryArgs {
  issue_key: string;
  summary?: string;
  description?: string;
  labels?: string[];
  priority?: Priority;
  story_points?: number;
}

const shape: z.ZodRawShape = {
  issue_key: z.string().min(1).describe('Issue key, e.g. "PRD-42"'),
  summary: z.string().min(1).optional().describe("New summary / title"),
  description: z.string().optional().describe("New plain-text description"),
  labels: z.array(z.string()).optional().describe("Replacement labels list"),
  priority: z.enum(PRIORITY_VALUES).optional().describe("New priority"),
  story_points: z.number().optional().describe("New story point estimate"),
};

export function registerUpdateStory(server: McpServer): void {
  registerTool(
    server,
    "update_story",
    "Updates fields of an existing Story (e.g. after human approval edits). Only the fields you supply are changed. Returns { success, key }.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as UpdateStoryArgs;
      try {
        const fields: Record<string, unknown> = {};

        if (args.summary !== undefined) fields.summary = args.summary;
        if (args.description !== undefined)
          fields.description = args.description;
        if (args.labels !== undefined) fields.labels = args.labels;
        if (args.priority !== undefined)
          fields.priority = { name: args.priority };
        if (args.story_points !== undefined) {
          fields[config.storyPointsCustomField] = args.story_points;
        }

        if (Object.keys(fields).length === 0) {
          return fail({ error: true, message: "No fields provided to update" });
        }

        await http.put(`/issue/${args.issue_key}`, { fields });

        return ok({ success: true, key: args.issue_key });
      } catch (err) {
        return fail(toToolError(err, { issueKey: args.issue_key }));
      }
    }
  );
}
