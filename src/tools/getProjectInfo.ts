import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { projectKeyField, registerTool, resolveProject } from "./shared";

interface GetProjectInfoArgs {
  project_key?: string;
}

const shape: z.ZodRawShape = {
  project_key: projectKeyField,
};

export function registerGetProjectInfo(server: McpServer): void {
  registerTool(
    server,
    "get_project_info",
    "Returns metadata for a Jira project: project key/name, available priorities, and the issue type id for Stories. Defaults to the configured project; pass project_key to target another. Use this to validate input before creating issues.",
    shape,
    { readOnlyHint: true, openWorldHint: true },
    async (rawArgs) => {
      const args = rawArgs as unknown as GetProjectInfoArgs;
      const project = resolveProject(args.project_key);
      if ("error" in project) return project.error;
      try {
        const [projectRes, priorityRes] = await Promise.all([
          http.get(`/project/${project.key}`),
          http.get(`/priority`),
        ]);

        const projectData = projectRes.data;
        const priorities = (priorityRes.data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
        }));

        const storyIssueType = (projectData.issueTypes ?? []).find(
          (it: any) =>
            it.name?.toLowerCase() === config.storyIssueType.toLowerCase()
        );

        return ok({
          project_key: projectData.key,
          project_name: projectData.name,
          available_priorities: priorities,
          available_issue_types: (projectData.issueTypes ?? []).map(
            (it: any) => ({
              id: it.id,
              name: it.name,
            })
          ),
          story_issuetype_id: storyIssueType?.id ?? null,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
