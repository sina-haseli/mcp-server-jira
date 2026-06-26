import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { registerTool } from "./shared";

export function registerListProjects(server: McpServer): void {
  registerTool(
    server,
    "list_projects",
    "Lists all Jira projects visible to the account. Returns key, name, id and project type for each. Use this to discover which project_key to pass to other tools when working across multiple projects.",
    {},
    { readOnlyHint: true, openWorldHint: true },
    async () => {
      try {
        const { data } = await http.get(`/project`);
        const projects = (Array.isArray(data) ? data : []).map((p: any) => ({
          key: p.key,
          name: p.name,
          id: p.id,
          project_type_key: p.projectTypeKey ?? null,
        }));

        return ok({ total: projects.length, projects });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
