import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { agile } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { registerTool } from "./shared";

interface ListBoardsArgs {
  all_projects?: boolean;
}

const shape: z.ZodRawShape = {
  all_projects: z
    .boolean()
    .optional()
    .describe(
      "If true, list boards across all projects; otherwise only boards for the configured project (default)."
    ),
};

export function registerListBoards(server: McpServer): void {
  registerTool(
    server,
    "list_boards",
    "Lists Jira Software Agile boards (scrum/kanban). Returns board id, name and type. The board id is needed to list sprints and fetch burndown data. Requires Jira Software (Agile) on the instance.",
    shape,
    { readOnlyHint: true, openWorldHint: true },
    async (rawArgs) => {
      const args = rawArgs as unknown as ListBoardsArgs;
      try {
        const params: Record<string, unknown> = { maxResults: 50 };
        if (!args.all_projects) params.projectKeyOrId = config.projectKey;

        const { data } = await agile.get(`/board`, { params });
        const boards = (data.values ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          type: b.type,
        }));

        return ok({ total: data.total ?? boards.length, boards });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
