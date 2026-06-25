import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAddComment } from "./addComment";
import { registerCreateStory } from "./createStory";
import { registerDeleteStory } from "./deleteStory";
import { registerGetProjectInfo } from "./getProjectInfo";
import { registerGetSprintBurndown } from "./getSprintBurndown";
import { registerGetStory } from "./getStory";
import { registerListBoards } from "./listBoards";
import { registerListSprints } from "./listSprints";
import { registerSearchStories } from "./searchStories";
import { registerTransitionStory } from "./transitionStory";
import { registerUpdateStory } from "./updateStory";

/** Register every Jira tool on the given MCP server. */
export function registerAllTools(server: McpServer): void {
  // Story CRUD
  registerCreateStory(server);
  registerGetStory(server);
  registerUpdateStory(server);
  registerSearchStories(server);
  registerGetProjectInfo(server);
  registerAddComment(server);

  // Workflow + guarded/destructive actions
  registerTransitionStory(server);
  registerDeleteStory(server);

  // Agile: boards, sprints, burndown
  registerListBoards(server);
  registerListSprints(server);
  registerGetSprintBurndown(server);
}
