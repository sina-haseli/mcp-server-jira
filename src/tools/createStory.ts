import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { browseUrl, http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { log } from "../logger";
import {
  PRIORITY_VALUES,
  Priority,
  projectKeyField,
  registerTool,
  resolveProject,
} from "./shared";

interface CreateStoryArgs {
  summary: string;
  description: string;
  acceptance_criteria: string;
  labels: string[];
  priority: Priority;
  story_points?: number;
  outline_doc_url?: string;
  project_key?: string;
}

const shape: z.ZodRawShape = {
  summary: z.string().min(1).describe("Story title / summary"),
  description: z.string().min(1).describe("Full description in plain text"),
  acceptance_criteria: z
    .string()
    .min(1)
    .describe("Acceptance criteria as a plain text list"),
  labels: z.array(z.string()).describe('Labels, e.g. ["external", "feature"]'),
  priority: z.enum(PRIORITY_VALUES).describe("Issue priority"),
  story_points: z
    .number()
    .optional()
    .describe("Optional story point estimate"),
  outline_doc_url: z
    .string()
    .url()
    .optional()
    .describe("Optional URL of the Outline PRD doc to link back to"),
  project_key: projectKeyField,
};

export function registerCreateStory(server: McpServer): void {
  registerTool(
    server,
    "create_story",
    "Creates a new Jira Story from a PRD. Formats the description with acceptance criteria and an optional Outline PRD link, sets labels and priority, and (if an Outline URL is supplied) attaches it as a remote link. Returns the created issue key, id, and browse URL.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as CreateStoryArgs;
      const project = resolveProject(args.project_key);
      if ("error" in project) return project.error;
      try {
        const descriptionLines = [
          args.description,
          "",
          "*Acceptance Criteria:*",
          args.acceptance_criteria,
        ];
        if (args.outline_doc_url) {
          descriptionLines.push("", `*Outline PRD:* ${args.outline_doc_url}`);
        }

        const fields: Record<string, unknown> = {
          project: { key: project.key },
          issuetype: { name: config.storyIssueType },
          summary: args.summary,
          description: descriptionLines.join("\n"),
          labels: args.labels,
          priority: { name: args.priority },
        };

        if (typeof args.story_points === "number") {
          fields[config.storyPointsCustomField] = args.story_points;
        }

        const { data } = await http.post<{ id: string; key: string }>(
          "/issue",
          { fields }
        );

        // Best-effort: attach the Outline doc as a remote link.
        if (args.outline_doc_url) {
          try {
            await http.post(`/issue/${data.key}/remotelink`, {
              object: { url: args.outline_doc_url, title: "Outline PRD" },
            });
          } catch (linkErr) {
            log(
              `Story ${data.key} created, but failed to attach remote link:`,
              toToolError(linkErr).message
            );
          }
        }

        return ok({ key: data.key, id: data.id, url: browseUrl(data.key) });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
