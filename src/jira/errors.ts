import axios, { AxiosError } from "axios";

import { config } from "../config";

export interface ToolError {
  error: true;
  message: string;
  status?: number;
  details?: unknown;
}

/**
 * Translate any thrown error (axios or otherwise) into a clean, structured
 * error object. `context.issueKey` lets us produce 404/connection messages that
 * mention the relevant issue.
 */
export function toToolError(
  err: unknown,
  context: { issueKey?: string } = {}
): ToolError {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError;

    // No response => network / DNS / connection problem.
    if (!axErr.response) {
      return {
        error: true,
        message: `Cannot connect to Jira at ${config.baseUrl} — check JIRA_BASE_URL (${axErr.code ?? "network error"})`,
      };
    }

    const status = axErr.response.status;
    const data = axErr.response.data as
      | { errorMessages?: string[]; errors?: Record<string, string> }
      | undefined;

    switch (status) {
      case 401:
        return {
          error: true,
          status,
          message:
            "Invalid Jira credentials — check JIRA_USER_EMAIL and JIRA_API_TOKEN",
        };
      case 403:
        return {
          error: true,
          status,
          message:
            "Forbidden — the Jira account lacks permission for this operation",
        };
      case 404:
        return {
          error: true,
          status,
          message: context.issueKey
            ? `Issue not found: ${context.issueKey}`
            : "Jira resource not found (404)",
        };
      case 400: {
        const parts: string[] = [];
        if (data?.errorMessages?.length) parts.push(...data.errorMessages);
        if (data?.errors) {
          for (const [field, msg] of Object.entries(data.errors)) {
            parts.push(`${field}: ${msg}`);
          }
        }
        return {
          error: true,
          status,
          message:
            parts.length > 0
              ? `Jira rejected the request (400): ${parts.join("; ")}`
              : "Jira rejected the request (400 Bad Request)",
          details: data,
        };
      }
      default:
        return {
          error: true,
          status,
          message: `Jira returned HTTP ${status}${
            data?.errorMessages?.length
              ? `: ${data.errorMessages.join("; ")}`
              : ""
          }`,
          details: data,
        };
    }
  }

  return {
    error: true,
    message: err instanceof Error ? err.message : "Unknown error",
  };
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** Wrap any object as a successful MCP tool result (JSON text content). */
export function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

/** Wrap a ToolError as an MCP tool result flagged with isError. */
export function fail(toolError: ToolError): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(toolError, null, 2) }],
  };
}
