import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { confirmField, needsConfirmation, registerTool } from "./shared";

interface CreateIssueTypeArgs {
  name: string;
  description?: string;
  type?: "standard" | "subtask";
  confirm?: boolean;
}

const shape: z.ZodRawShape = {
  name: z.string().min(1).describe("Name of the new issue type, e.g. \"Spike\""),
  description: z.string().optional().describe("Optional description"),
  type: z
    .enum(["standard", "subtask"])
    .optional()
    .describe("Issue type kind (default standard)"),
  confirm: confirmField,
};

export function registerCreateIssueType(server: McpServer): void {
  registerTool(
    server,
    "create_issue_type",
    "Creates a new issue type in Jira (admin only). Guarded: requires confirm:true. Issue types are global across the instance.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as CreateIssueTypeArgs;

      const guard = needsConfirmation(
        args.confirm,
        `This will create a new global issue type "${args.name}" (requires Jira admin rights).`
      );
      if (guard) return guard;

      try {
        const { data } = await http.post(`/issuetype`, {
          name: args.name,
          description: args.description ?? "",
          type: args.type ?? "standard",
        });

        return ok({
          success: true,
          id: data.id,
          name: data.name,
          subtask: data.subtask ?? false,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
