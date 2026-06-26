#!/usr/bin/env node
import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "./config";
import { log } from "./logger";
import { registerAllTools } from "./tools";

async function main(): Promise<void> {
  const server = new McpServer({
    name: "jira-mcp-server",
    version: "1.0.0",
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(
    `Jira MCP server running (project=${config.projectKey}, base=${config.baseUrl})`
  );
}

main().catch((err) => {
  log("Fatal error starting server:", err);
  process.exit(1);
});
