import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { agile } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { registerTool } from "./shared";

interface ListSprintsArgs {
  board_id: number;
  state?: "active" | "future" | "closed";
}

const shape: z.ZodRawShape = {
  board_id: z
    .number()
    .int()
    .describe("Board id (from list_boards) whose sprints to list"),
  state: z
    .enum(["active", "future", "closed"])
    .optional()
    .describe("Optional filter by sprint state"),
};

export function registerListSprints(server: McpServer): void {
  registerTool(
    server,
    "list_sprints",
    "Lists sprints for a given Agile board. Returns sprint id, name, state, and start/end dates. Use the sprint id with get_sprint_burndown. Requires a scrum board.",
    shape,
    { readOnlyHint: true, openWorldHint: true },
    async (rawArgs) => {
      const args = rawArgs as unknown as ListSprintsArgs;
      try {
        const params: Record<string, unknown> = { maxResults: 50 };
        if (args.state) params.state = args.state;

        const { data } = await agile.get(`/board/${args.board_id}/sprint`, {
          params,
        });
        const sprints = (data.values ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          state: s.state,
          start_date: s.startDate ?? null,
          end_date: s.endDate ?? null,
          complete_date: s.completeDate ?? null,
          goal: s.goal ?? null,
        }));

        return ok({ total: data.total ?? sprints.length, sprints });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
