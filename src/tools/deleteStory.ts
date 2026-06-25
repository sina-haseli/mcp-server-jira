import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { confirmField, needsConfirmation, registerTool } from "./shared";

interface DeleteStoryArgs {
  issue_key: string;
  delete_subtasks?: boolean;
  confirm?: boolean;
}

const shape: z.ZodRawShape = {
  issue_key: z.string().min(1).describe('Issue key to delete, e.g. "PRD-42"'),
  delete_subtasks: z
    .boolean()
    .optional()
    .describe("If true, also delete any subtasks (default false)"),
  confirm: confirmField,
};

export function registerDeleteStory(server: McpServer): void {
  registerTool(
    server,
    "delete_story",
    "PERMANENTLY deletes a Story by issue key. This is irreversible. Guarded: without confirm:true it returns a warning instead of deleting. Intended for human-approved cleanup only.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as DeleteStoryArgs;

      const guard = needsConfirmation(
        args.confirm,
        `This will PERMANENTLY delete ${args.issue_key}${
          args.delete_subtasks ? " and all its subtasks" : ""
        }. Deleted issues cannot be recovered.`
      );
      if (guard) return guard;

      try {
        await http.delete(`/issue/${args.issue_key}`, {
          params: { deleteSubtasks: args.delete_subtasks ? "true" : "false" },
        });
        return ok({ success: true, deleted: args.issue_key });
      } catch (err) {
        return fail(toToolError(err, { issueKey: args.issue_key }));
      }
    }
  );
}
