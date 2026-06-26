# mcp-server-jira

An [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that lets an AI agent
manage Jira **Stories** in a **self-hosted Jira** instance via the Jira REST API **v2**. Built for a
PRD automation workflow.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your values
npm run build
```

## Configuration

All config comes from environment variables (loaded from `.env`):

| Variable                   | Required | Description                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------------ |
| `JIRA_BASE_URL`            | ✅       | Base URL of the Jira instance, e.g. `https://jira.yourcompany.com`       |
| `JIRA_USER_EMAIL`          | ✅       | Account email/username used for Basic Auth                               |
| `JIRA_API_TOKEN`           | ✅       | API token / password used for Basic Auth                                 |
| `JIRA_PROJECT_KEY`         | ✅       | Project key, e.g. `PRD`                                                   |
| `JIRA_STORY_ISSUE_TYPE`    |          | Issue type name for stories (default `Story`)                            |
| `JIRA_OUTLINE_LINK_FIELD`  |          | Custom field id for the Outline link (e.g. `customfield_10100`)          |
| `JIRA_STORY_POINTS_FIELD`  |          | Custom field id for story points (default `customfield_10016`)           |

Authentication uses HTTP Basic Auth: `base64(JIRA_USER_EMAIL:JIRA_API_TOKEN)`.
All API calls target `${JIRA_BASE_URL}/rest/api/2`.

## Running

The server speaks MCP over **stdio**.

```bash
npm start          # runs dist/index.js
npm run dev        # ts-node src/index.ts
```

### Example MCP client config

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-jira/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://jira.yourcompany.com",
        "JIRA_USER_EMAIL": "bot@yourcompany.com",
        "JIRA_API_TOKEN": "...",
        "JIRA_PROJECT_KEY": "PRD"
      }
    }
  }
}
```

## Tools

### Story CRUD

| Tool               | Purpose                                                              |
| ------------------ | ------------------------------------------------------------------- |
| `create_story`     | Create a Story from a PRD (with acceptance criteria + Outline link) |
| `get_story`        | Fetch a Story's key fields by issue key                             |
| `update_story`     | Update selected fields of a Story                                   |
| `search_stories`   | JQL text search for Stories (duplicate detection)                   |
| `get_project_info` | Project metadata: priorities, issue types, story type id            |
| `add_comment`      | Add a plain-text comment to a Story                                 |

### Workflow & guarded actions

| Tool                | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `transition_story`  | List or perform workflow transitions. Transitions to Done/Closed need `confirm`. |
| `delete_story`      | **Permanently** delete a Story. Requires `confirm: true`.                        |

### Projects (multi-project)

| Tool                | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `list_projects`     | List all visible projects (discover `project_key` values).               |
| `create_project`    | **Admin.** Create a project. Requires `confirm: true`.                   |
| `create_issue_type` | **Admin.** Create a global issue type. Requires `confirm: true`.         |

### Agile / burndown (requires Jira Software)

| Tool                  | Purpose                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `list_boards`         | List Agile boards (scrum/kanban) — get a board id                     |
| `list_sprints`        | List a board's sprints with start/end dates and state                 |
| `get_sprint_burndown` | Burndown **data** for AI analysis (committed vs done vs remaining)    |
| `create_board`        | Create a scrum/kanban board from a saved filter. Requires `confirm`.  |
| `create_sprint`       | Create a sprint on a board. Requires `confirm: true`.                 |

## Multiple projects

`JIRA_PROJECT_KEY` / `projectKey` is now an **optional default**. Every
project-scoped tool (`create_story`, `search_stories`, `get_project_info`,
`list_boards`) accepts an optional `project_key` argument that overrides the
default for that call. Use `list_projects` to discover available keys. If no
`project_key` is passed and no default is configured, the tool returns a clear
error rather than guessing.

## Safety: human approval for risky actions

Two complementary mechanisms protect destructive operations:

1. **MCP annotations** — every tool declares `readOnlyHint` / `destructiveHint` /
   `idempotentHint` / `openWorldHint`. The host (e.g. Claude) uses these to decide
   when to prompt the human before running a tool. Read-only tools (`get_*`,
   `search_*`, `list_*`) are flagged as such; `update_story`, `delete_story` are
   flagged destructive.

2. **Server-enforced confirmation** — `delete_story`, terminal
   `transition_story` calls, and all admin `create_*` tools (`create_project`,
   `create_issue_type`, `create_board`, `create_sprint`) require an explicit
   `confirm: true`. Without it the tool performs **no** API call and instead
   returns a `requires_confirmation` warning describing the impact, so the agent
   (and human) must opt in deliberately.

## Burndown charts

An MCP server can't return a rendered chart image, but `get_sprint_burndown`
returns the underlying data: a reliable computed summary (committed/completed/
remaining story points and issue counts by status, derived from the sprint's
issues) plus a best-effort raw GreenHopper burndown time-series
(`burndown_chart_raw`) when that internal endpoint is available. The AI can
summarize progress, flag scope changes, and describe the burndown from this data.
Story points are read from `JIRA_STORY_POINTS_FIELD`.

---

All tools return structured JSON. Errors are returned as structured objects
(`{ error: true, message, ... }`) — the server never throws unhandled exceptions
out of a tool. Logs are written to **stderr** only; **stdout** is reserved for the
MCP protocol.
