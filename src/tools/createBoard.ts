import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { agile } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { confirmField, needsConfirmation, registerTool } from "./shared";

interface CreateBoardArgs {
  name: string;
  type: "scrum" | "kanban";
  filter_id: number;
  confirm?: boolean;
}

const shape: z.ZodRawShape = {
  name: z.string().min(1).describe("Board name"),
  type: z.enum(["scrum", "kanban"]).describe("Board type"),
  filter_id: z
    .number()
    .int()
    .describe(
      "Id of an existing saved filter that scopes the board's issues (boards are backed by a filter)."
    ),
  confirm: confirmField,
};

export function registerCreateBoard(server: McpServer): void {
  registerTool(
    server,
    "create_board",
    "Creates a Jira Software Agile board (scrum/kanban) from an existing saved filter. Guarded: requires confirm:true. Requires Jira Software and permission to manage boards.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as CreateBoardArgs;

      const guard = needsConfirmation(
        args.confirm,
        `This will create a new ${args.type} board "${args.name}" backed by filter ${args.filter_id}.`
      );
      if (guard) return guard;

      try {
        const { data } = await agile.post(`/board`, {
          name: args.name,
          type: args.type,
          filterId: args.filter_id,
        });

        return ok({
          success: true,
          id: data.id,
          name: data.name,
          type: data.type,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
