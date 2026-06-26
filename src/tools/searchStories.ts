import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { browseUrl, http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { projectKeyField, registerTool, resolveProject } from "./shared";

interface SearchStoriesArgs {
  query: string;
  max_results?: number;
  project_key?: string;
}

const shape: z.ZodRawShape = {
  query: z
    .string()
    .min(1)
    .describe("Plain text search; matched against issue text via JQL ~"),
  max_results: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum results to return (default 10)"),
  project_key: projectKeyField,
};

/** Escape characters that would break a JQL quoted string. */
function escapeJql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function registerSearchStories(server: McpServer): void {
  registerTool(
    server,
    "search_stories",
    "Searches for Stories in the configured project using a plain-text query (wrapped in JQL). Useful for checking duplicates before creating a new Story. Returns an array of { key, summary, status, labels, url }.",
    shape,
    { readOnlyHint: true, openWorldHint: true },
    async (rawArgs) => {
      const args = rawArgs as unknown as SearchStoriesArgs;
      const project = resolveProject(args.project_key);
      if ("error" in project) return project.error;
      try {
        const maxResults = args.max_results ?? 10;
        const jql = `project = "${escapeJql(project.key)}" AND issuetype = ${config.storyIssueType} AND text ~ "${escapeJql(
          args.query
        )}" ORDER BY created DESC`;

        const { data } = await http.post("/search", {
          jql,
          maxResults,
          fields: ["summary", "status", "labels", "priority"],
        });

        const issues = (data.issues ?? []).map((issue: any) => ({
          key: issue.key,
          summary: issue.fields?.summary ?? null,
          status: issue.fields?.status?.name ?? null,
          labels: issue.fields?.labels ?? [],
          priority: issue.fields?.priority?.name ?? null,
          url: browseUrl(issue.key),
        }));

        return ok({ total: data.total ?? issues.length, issues });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
