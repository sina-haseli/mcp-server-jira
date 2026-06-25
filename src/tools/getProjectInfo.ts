import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { config } from "../config";
import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { registerTool } from "./shared";

export function registerGetProjectInfo(server: McpServer): void {
  registerTool(
    server,
    "get_project_info",
    "Returns metadata for the configured Jira project: project key/name, available priorities, and the issue type id for Stories. Use this to validate input before creating issues.",
    {},
    { readOnlyHint: true, openWorldHint: true },
    async () => {
      try {
        const [projectRes, priorityRes] = await Promise.all([
          http.get(`/project/${config.projectKey}`),
          http.get(`/priority`),
        ]);

        const project = projectRes.data;
        const priorities = (priorityRes.data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
        }));

        const storyIssueType = (project.issueTypes ?? []).find(
          (it: any) =>
            it.name?.toLowerCase() === config.storyIssueType.toLowerCase()
        );

        return ok({
          project_key: project.key,
          project_name: project.name,
          available_priorities: priorities,
          available_issue_types: (project.issueTypes ?? []).map((it: any) => ({
            id: it.id,
            name: it.name,
          })),
          story_issuetype_id: storyIssueType?.id ?? null,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
