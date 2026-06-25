import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { http } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { confirmField, needsConfirmation, registerTool } from "./shared";

interface TransitionStoryArgs {
  issue_key: string;
  transition?: string;
  comment?: string;
  confirm?: boolean;
}

const shape: z.ZodRawShape = {
  issue_key: z.string().min(1).describe('Issue key, e.g. "PRD-42"'),
  transition: z
    .string()
    .optional()
    .describe(
      "Target transition name (e.g. \"Done\") or transition id. Omit to just list the available transitions for this issue."
    ),
  comment: z
    .string()
    .optional()
    .describe("Optional comment to add as part of the transition"),
  confirm: confirmField,
};

interface JiraTransition {
  id: string;
  name: string;
  to?: { name?: string; statusCategory?: { key?: string } };
}

export function registerTransitionStory(server: McpServer): void {
  registerTool(
    server,
    "transition_story",
    "Moves a Story through its workflow (e.g. To Do -> In Progress -> Done). Call without `transition` to list available transitions. Transitions into a terminal status (Done/Closed/Resolved) are guarded and require confirm:true.",
    shape,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (rawArgs) => {
      const args = rawArgs as unknown as TransitionStoryArgs;
      try {
        // Always fetch the available transitions first.
        const { data } = await http.get(`/issue/${args.issue_key}/transitions`);
        const transitions: JiraTransition[] = data.transitions ?? [];

        // Discovery mode: no target supplied -> return the menu.
        if (!args.transition) {
          return ok({
            issue_key: args.issue_key,
            available_transitions: transitions.map((t) => ({
              id: t.id,
              name: t.name,
              to: t.to?.name ?? null,
            })),
          });
        }

        const wanted = args.transition.trim().toLowerCase();
        const match = transitions.find(
          (t) => t.id === args.transition || t.name?.toLowerCase() === wanted
        );

        if (!match) {
          return fail({
            error: true,
            message: `No available transition "${args.transition}" for ${args.issue_key}. Available: ${transitions
              .map((t) => t.name)
              .join(", ")}`,
          });
        }

        // Guard transitions into a terminal (done) status.
        const isTerminal = match.to?.statusCategory?.key === "done";
        if (isTerminal) {
          const guard = needsConfirmation(
            args.confirm,
            `This will move ${args.issue_key} into the terminal status "${match.to?.name}". This typically closes the Story.`
          );
          if (guard) return guard;
        }

        const body: Record<string, unknown> = {
          transition: { id: match.id },
        };
        if (args.comment) {
          body.update = { comment: [{ add: { body: args.comment } }] };
        }

        await http.post(`/issue/${args.issue_key}/transitions`, body);

        return ok({
          success: true,
          key: args.issue_key,
          transitioned_to: match.to?.name ?? match.name,
        });
      } catch (err) {
        return fail(toToolError(err, { issueKey: args.issue_key }));
      }
    }
  );
}
