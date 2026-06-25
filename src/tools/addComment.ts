import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { registerTool } from "./shared";

interface AddCommentArgs {
  issue_key: string;
  body: string;
}

const shape: z.ZodRawShape = {
  issue_key: z.string().min(1).describe('Issue key, e.g. "PRD-42"'),
  body: z.string().min(1).describe("Plain text comment body"),
};

export function registerAddComment(server: McpServer): void {
  registerTool(
    server,
    "add_comment",
    "Adds a plain-text comment to a Story. Used, for example, to log when the PRD doc is updated in Outline. Returns { success, comment_id }.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as AddCommentArgs;
      try {
        const { data } = await http.post(`/issue/${args.issue_key}/comment`, {
          body: args.body,
        });

        return ok({ success: true, comment_id: data.id });
      } catch (err) {
        return fail(toToolError(err, { issueKey: args.issue_key }));
      }
    }
  );
}
