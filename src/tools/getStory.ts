import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { browseUrl, http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { registerTool } from "./shared";

interface GetStoryArgs {
  issue_key: string;
}

const shape: z.ZodRawShape = {
  issue_key: z.string().min(1).describe('Issue key, e.g. "PRD-42"'),
};

export function registerGetStory(server: McpServer): void {
  registerTool(
    server,
    "get_story",
    "Retrieves a Story by its issue key (e.g. PRD-42). Returns the key fields an AI agent needs: summary, description, status, labels, priority, and browse URL.",
    shape,
    { readOnlyHint: true, openWorldHint: true },
    async (rawArgs) => {
      const args = rawArgs as unknown as GetStoryArgs;
      try {
        const { data } = await http.get(`/issue/${args.issue_key}`, {
          params: {
            fields:
              "summary,description,status,labels,priority,assignee,created,updated",
          },
        });

        const f = data.fields ?? {};
        return ok({
          key: data.key,
          summary: f.summary ?? null,
          description: f.description ?? null,
          status: f.status?.name ?? null,
          labels: f.labels ?? [],
          priority: f.priority?.name ?? null,
          assignee: f.assignee?.displayName ?? null,
          created: f.created ?? null,
          updated: f.updated ?? null,
          url: browseUrl(data.key),
        });
      } catch (err) {
        return fail(toToolError(err, { issueKey: args.issue_key }));
      }
    }
  );
}
