/**
 * Log to stderr only. stdout is reserved for MCP protocol messages, so anything
 * written there would corrupt the JSON-RPC stream.
 */
export function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error("[mcp-server-jira]", ...args);
}
