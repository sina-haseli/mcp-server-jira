import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { confirmField, needsConfirmation, registerTool } from "./shared";

interface CreateProjectArgs {
  key: string;
  name: string;
  lead: string;
  project_type_key?: string;
  template_key?: string;
  description?: string;
  assignee_type?: "PROJECT_LEAD" | "UNASSIGNED";
  confirm?: boolean;
}

const shape: z.ZodRawShape = {
  key: z
    .string()
    .min(2)
    .describe("Project key, uppercase, e.g. \"NEW\" (must be unique)"),
  name: z.string().min(1).describe("Project display name"),
  lead: z
    .string()
    .min(1)
    .describe(
      "Project lead. On Jira Server/DC this is the username; on Cloud it is the account id."
    ),
  project_type_key: z
    .string()
    .optional()
    .describe('Project type key, e.g. "software" or "business" (default "software")'),
  template_key: z
    .string()
    .optional()
    .describe(
      "Optional project template key (some Jira versions require this, e.g. com.pyxis.greenhopper.jira:gh-simplified-scrum-classic)."
    ),
  description: z.string().optional().describe("Optional project description"),
  assignee_type: z
    .enum(["PROJECT_LEAD", "UNASSIGNED"])
    .optional()
    .describe("Default assignee policy"),
  confirm: confirmField,
};

export function registerCreateProject(server: McpServer): void {
  registerTool(
    server,
    "create_project",
    "Creates a new Jira project (admin only). Guarded: requires confirm:true. Some Jira versions require a template_key; if creation fails for that reason, retry with template_key.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as CreateProjectArgs;

      const guard = needsConfirmation(
        args.confirm,
        `This will create a new Jira project "${args.name}" (key ${args.key}) with lead "${args.lead}" (requires Jira admin rights).`
      );
      if (guard) return guard;

      try {
        const body: Record<string, unknown> = {
          key: args.key,
          name: args.name,
          lead: args.lead,
          projectTypeKey: args.project_type_key ?? "software",
        };
        if (args.template_key) body.projectTemplateKey = args.template_key;
        if (args.description) body.description = args.description;
        if (args.assignee_type) body.assigneeType = args.assignee_type;

        const { data } = await http.post(`/project`, body);

        return ok({
          success: true,
          id: data.id,
          key: data.key ?? args.key,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
