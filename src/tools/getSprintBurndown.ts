import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config";
import { agile, greenhopper } from "../jira/client";
import { fail, ok, toToolError } from "../jira/errors";
import { log } from "../logger";
import { registerTool } from "./shared";

interface GetSprintBurndownArgs {
  board_id: number;
  sprint_id: number;
}

const shape: z.ZodRawShape = {
  board_id: z
    .number()
    .int()
    .describe("Board id (rapid view id) the sprint belongs to"),
  sprint_id: z.number().int().describe("Sprint id (from list_sprints)"),
};

export function registerGetSprintBurndown(server: McpServer): void {
  registerTool(
    server,
    "get_sprint_burndown",
    "Returns burndown data for a sprint so the AI can analyze/summarize progress (this is data, not a rendered chart image). Includes a reliable computed summary (committed vs completed vs remaining story points, issue counts by status) plus best-effort raw GreenHopper burndown time-series. Requires Jira Software.",
    shape,
    { readOnlyHint: true, openWorldHint: true },
    async (rawArgs) => {
      const args = rawArgs as unknown as GetSprintBurndownArgs;
      const pointsField = config.storyPointsCustomField;

      try {
        // --- Sprint meta + issues (reliable, core Agile API) ------------------
        const [sprintRes, issuesRes] = await Promise.all([
          agile.get(`/sprint/${args.sprint_id}`),
          agile.get(`/sprint/${args.sprint_id}/issue`, {
            params: {
              maxResults: 200,
              fields: `summary,status,${pointsField}`,
            },
          }),
        ]);

        const sprint = sprintRes.data;
        const issues: any[] = issuesRes.data.issues ?? [];

        let committedPoints = 0;
        let completedPoints = 0;
        let doneCount = 0;
        let inProgressCount = 0;
        let todoCount = 0;

        for (const issue of issues) {
          const points = Number(issue.fields?.[pointsField]) || 0;
          committedPoints += points;

          const categoryKey: string | undefined =
            issue.fields?.status?.statusCategory?.key;
          if (categoryKey === "done") {
            completedPoints += points;
            doneCount += 1;
          } else if (categoryKey === "indeterminate") {
            inProgressCount += 1;
          } else {
            todoCount += 1;
          }
        }

        const summary = {
          total_issues: issues.length,
          committed_points: committedPoints,
          completed_points: completedPoints,
          remaining_points: committedPoints - completedPoints,
          issues_done: doneCount,
          issues_in_progress: inProgressCount,
          issues_todo: todoCount,
          story_points_field: pointsField,
        };

        // --- Best-effort raw burndown time-series (GreenHopper) ---------------
        // This internal endpoint is version-dependent; failure is non-fatal.
        let burndownChartRaw: unknown = null;
        let burndownNote =
          "GreenHopper burndown series not requested or unavailable; summary above is computed from current sprint issues.";
        try {
          const chartRes = await greenhopper.get(
            `/rapid/charts/scopechangeburndownchart`,
            { params: { rapidViewId: args.board_id, sprintId: args.sprint_id } }
          );
          burndownChartRaw = chartRes.data;
          burndownNote =
            "burndown_chart_raw contains the GreenHopper scope-change burndown payload (startTime/endTime/now + per-timestamp changes). Interpret the changes to build a remaining-work-over-time series.";
        } catch (chartErr) {
          log(
            `Burndown chart unavailable for sprint ${args.sprint_id}:`,
            toToolError(chartErr).message
          );
        }

        return ok({
          sprint: {
            id: sprint.id,
            name: sprint.name,
            state: sprint.state,
            start_date: sprint.startDate ?? null,
            end_date: sprint.endDate ?? null,
            complete_date: sprint.completeDate ?? null,
            goal: sprint.goal ?? null,
          },
          summary,
          burndown_note: burndownNote,
          burndown_chart_raw: burndownChartRaw,
        });
      } catch (err) {
        return fail(toToolError(err));
      }
    }
  );
}
