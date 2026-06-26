import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { agile } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { confirmField, needsConfirmation, registerTool } from "./shared";

interface CreateSprintArgs {
  board_id: number;
  name: string;
  start_date?: string;
  end_date?: string;
  goal?: string;
  confirm?: boolean;
}

const shape: z.ZodRawShape = {
  board_id: z
    .number()
    .int()
    .describe("Id of the scrum board to create the sprint on"),
  name: z.string().min(1).describe("Sprint name"),
  start_date: z
    .string()
    .optional()
    .describe("Optional start date, ISO 8601 (e.g. 2026-07-01T09:00:00.000Z)"),
  end_date: z
    .string()
    .optional()
    .describe("Optional end date, ISO 8601"),
  goal: z.string().optional().describe("Optional sprint goal"),
  confirm: confirmField,
};

export function registerCreateSprint(server: McpServer): void {
  registerTool(
    server,
    "create_sprint",
    "Creates a sprint on a scrum board. Guarded: requires confirm:true. Requires Jira Software.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as CreateSprintArgs;

      const guard = needsConfirmation(
        args.confirm,
        `This will create sprint "${args.name}" on board ${args.board_id}.`
      );
      if (guard) return guard;

      try {
        const body: Record<string, unknown> = {
          name: args.name,
          originBoardId: args.board_id,
        };
        if (args.start_date) body.startDate = args.start_date;
        if (args.end_date) body.endDate = args.end_date;
        if (args.goal) body.goal = args.goal;

        const { data } = await agile.post(`/sprint`, body);

        return ok({
          success: true,
          id: data.id,
          name: data.name,
          state: data.state,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
