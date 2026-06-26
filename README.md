# @deomi/mcp-server-jira

[![npm version](https://img.shields.io/npm/v/@deomi/mcp-server-jira.svg)](https://www.npmjs.com/package/@deomi/mcp-server-jira)
[![CI](https://github.com/sina-haseli/mcp-server-jira/actions/workflows/ci.yml/badge.svg)](https://github.com/sina-haseli/mcp-server-jira/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that lets an AI agent
manage a **self-hosted Jira** instance over the Jira REST API **v2** — create and edit Stories,
search, transition workflows, manage boards & sprints, read burndown data, and (with confirmation)
perform admin actions. Built for a PRD automation workflow, usable as a general Jira agent backend.

- **Transport:** stdio
- **Auth:** HTTP Basic (`email:api_token`)
- **16 tools** across Story CRUD, workflow, multi-project, and Agile
- **Safety first:** read/write/destructive annotations + server-enforced confirmation on risky actions

---

## Table of contents

- [Install](#install)
- [Configuration](#configuration)
- [Use with Claude Desktop](#use-with-claude-desktop)
- [Tools](#tools)
- [Safety: human approval for risky actions](#safety-human-approval-for-risky-actions)
- [Multiple projects](#multiple-projects)
- [Burndown](#burndown)
- [Development](#development)
- [Releasing](#releasing)
- [License](#license)

---

## Install

Once published, run it directly with `npx` (no global install needed):

```bash
npx -y @deomi/mcp-server-jira
```

Or install globally:

```bash
npm install -g @deomi/mcp-server-jira
mcp-server-jira
```

Or from source:

```bash
git clone https://github.com/sina-haseli/mcp-server-jira.git
cd mcp-server-jira
npm install
npm run build
node dist/index.js
```

The server reads config from the environment, so it won't do anything useful until you supply
credentials (see below). It logs to **stderr** and speaks MCP JSON-RPC on **stdout**.

---

## Configuration

Provide settings in **either** of two ways. Per-setting precedence is: **environment variable → config file**.

### Option A — a single config file (recommended for desktop clients)

Point `JIRA_MCP_CONFIG` at a JSON file:

```json
{
  "baseUrl": "https://jira.yourcompany.com",
  "userEmail": "you@yourcompany.com",
  "apiToken": "your_api_token_here",
  "projectKey": "PRD",
  "storyIssueType": "Story",
  "outlineLinkField": "customfield_10100",
  "storyPointsField": "customfield_10016"
}
```

A template is provided in [`jira-mcp.config.example.json`](jira-mcp.config.example.json). Keep your
real file out of version control (the default `.gitignore` already ignores `jira-mcp.config.json`).

### Option B — environment variables

| Variable                  | Required | Description                                                       |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `JIRA_BASE_URL`           | ✅       | Base URL, e.g. `https://jira.yourcompany.com`                     |
| `JIRA_USER_EMAIL`         | ✅       | Account email/username for Basic Auth                             |
| `JIRA_API_TOKEN`          | ✅       | API token / Personal Access Token (or password) for Basic Auth   |
| `JIRA_PROJECT_KEY`        | ➖       | **Default** project key (optional — override per call)            |
| `JIRA_STORY_ISSUE_TYPE`   | ➖       | Story issue type name (default `Story`)                           |
| `JIRA_OUTLINE_LINK_FIELD` | ➖       | Custom field id for the Outline link (e.g. `customfield_10100`)   |
| `JIRA_STORY_POINTS_FIELD` | ➖       | Custom field id for story points (default `customfield_10016`)    |
| `JIRA_MCP_CONFIG`         | ➖       | Path to a JSON config file (Option A)                             |

Required settings are validated at startup; if any are missing the server logs a clear error to
stderr and exits. `JIRA_PROJECT_KEY` is **optional** — see [Multiple projects](#multiple-projects).

All API calls target `${JIRA_BASE_URL}/rest/api/2` (core), `/rest/agile/1.0` (boards & sprints),
and `/rest/greenhopper/1.0` (burndown).

---

## Use with Claude Desktop

Open **Settings → Developer → Edit Config** (creates `%APPDATA%\Claude\claude_desktop_config.json`
on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) and add:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["D:\\projects\\mcp-server-jira\\dist\\index.js"],
      "env": {
        "JIRA_MCP_CONFIG": "D:\\projects\\mcp-server-jira\\jira-mcp.config.json"
      }
    }
  }
}
```

Or, once published to npm, with no local checkout:

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@deomi/mcp-server-jira"],
      "env": {
        "JIRA_MCP_CONFIG": "D:\\projects\\mcp-server-jira\\jira-mcp.config.json"
      }
    }
  }
}
```

**Fully quit** Claude Desktop (tray → Quit, not just close the window) and reopen. Then run
`get_project_info` from the chat to confirm auth and connectivity.

---

## Tools

### Story CRUD

| Tool               | Purpose                                                              |
| ------------------ | ------------------------------------------------------------------- |
| `create_story`     | Create a Story from a PRD (acceptance criteria + Outline link)      |
| `get_story`        | Fetch a Story's key fields by issue key                             |
| `update_story`     | Update selected fields of a Story                                   |
| `search_stories`   | JQL text search for Stories (duplicate detection)                   |
| `get_project_info` | Project metadata: priorities, issue types, story type id            |
| `add_comment`      | Add a plain-text comment to a Story                                 |

### Workflow & guarded actions

| Tool               | Purpose                                                                           |
| ------------------ | -------------------------------------------------------------------------------- |
| `transition_story` | List or perform workflow transitions. Transitions to Done/Closed need `confirm`. |
| `delete_story`     | **Permanently** delete a Story. Requires `confirm: true`.                         |

### Projects (multi-project)

| Tool                | Purpose                                                          |
| ------------------- | --------------------------------------------------------------- |
| `list_projects`     | List all visible projects (discover `project_key` values)       |
| `create_project`    | **Admin.** Create a project. Requires `confirm: true`.          |
| `create_issue_type` | **Admin.** Create a global issue type. Requires `confirm: true`.|

### Agile / burndown (requires Jira Software)

| Tool                  | Purpose                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `list_boards`         | List Agile boards (scrum/kanban) — get a board id                   |
| `list_sprints`        | List a board's sprints with start/end dates and state               |
| `get_sprint_burndown` | Burndown **data** for AI analysis (committed vs done vs remaining)   |
| `create_board`        | Create a scrum/kanban board from a saved filter. Requires `confirm`.|
| `create_sprint`       | Create a sprint on a board. Requires `confirm: true`.               |

Every tool returns structured JSON. Errors are returned as structured objects
(`{ error: true, message, ... }`) — the server never throws unhandled exceptions out of a tool.

---

## Safety: human approval for risky actions

Two complementary mechanisms protect destructive and high-impact operations:

1. **MCP annotations** — every tool declares `readOnlyHint` / `destructiveHint` / `idempotentHint` /
   `openWorldHint`. The host (e.g. Claude) uses these to decide when to prompt the human. Read-only
   tools (`get_*`, `search_*`, `list_*`) are flagged as such; `update_story` and `delete_story` are
   flagged destructive.

2. **Server-enforced confirmation** — `delete_story`, terminal `transition_story` calls, and all
   admin `create_*` tools (`create_project`, `create_issue_type`, `create_board`, `create_sprint`)
   require an explicit `confirm: true`. Without it the tool makes **no** API call and returns a
   `requires_confirmation` warning describing the impact, so the agent (and human) must opt in
   deliberately.

---

## Multiple projects

`JIRA_PROJECT_KEY` / `projectKey` is an **optional default**. Every project-scoped tool
(`create_story`, `search_stories`, `get_project_info`, `list_boards`) accepts an optional
`project_key` argument that overrides the default for that call. Use `list_projects` to discover
available keys. If no `project_key` is passed and no default is configured, the tool returns a clear
error rather than guessing.

---

## Burndown

An MCP server can't return a rendered chart image, but `get_sprint_burndown` returns the underlying
**data**: a reliable computed summary (committed / completed / remaining story points and issue
counts by status, derived from the sprint's issues) plus a best-effort raw GreenHopper burndown
time-series (`burndown_chart_raw`) when that internal endpoint is available. The AI can summarize
progress, flag scope changes, and describe the burndown from this data. Story points are read from
`JIRA_STORY_POINTS_FIELD`.

---

## Development

```bash
npm install
npm run dev      # ts-node src/index.ts
npm run build    # tsc -> dist/
npm start        # node dist/index.js
```

Project layout:

```
src/
├── index.ts            # bootstrap (stdio transport)
├── config.ts           # env / config-file loading + validation
├── logger.ts           # stderr logger
├── jira/
│   ├── client.ts       # axios clients (core / agile / greenhopper) + browseUrl
│   └── errors.ts       # error mapping + ok()/fail() result helpers
└── tools/
    ├── index.ts        # registerAllTools()
    ├── shared.ts       # registerTool wrapper, annotations, confirm + project helpers
    └── *.ts            # one file per tool
```

---

## Releasing

Releases are automated by [`.github/workflows/release.yml`](.github/workflows/release.yml): pushing a
`v*` tag builds the package, publishes it to npm (with provenance), and creates a GitHub Release with
auto-generated notes.

**One-time setup:** add a repo secret `NPM_TOKEN` (an npm *Automation* access token) under
**Settings → Secrets and variables → Actions**.

**Cut a release:**

```bash
npm version patch   # or minor / major — bumps package.json and creates the tag
git push --follow-tags
```

The workflow verifies the tag matches `package.json` before publishing.

---

## License

[MIT](LICENSE) © Sina Haseli
