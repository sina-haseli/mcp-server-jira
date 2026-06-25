import { readFileSync } from "fs";

import { log } from "./logger";

export interface AppConfig {
  baseUrl: string;
  apiBase: string;
  userEmail: string;
  apiToken: string;
  projectKey: string;
  storyIssueType: string;
  /** Custom field id for the Outline PRD link. */
  outlineLinkField?: string;
  /** Custom field id used to store story points. */
  storyPointsCustomField: string;
}

/** Shape of the optional JSON config file (camelCase keys). */
interface FileConfig {
  baseUrl?: string;
  userEmail?: string;
  apiToken?: string;
  projectKey?: string;
  storyIssueType?: string;
  outlineLinkField?: string;
  storyPointsField?: string;
}

/**
 * If JIRA_MCP_CONFIG points at a JSON file, load it. Returns {} when the var is
 * unset (env-var-only mode). Exits with a clear error if the path is set but the
 * file can't be read/parsed.
 */
function loadFileConfig(): FileConfig {
  const path = process.env.JIRA_MCP_CONFIG;
  if (!path || path.trim() === "") return {};

  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as FileConfig;
  } catch (err) {
    log(
      `FATAL: JIRA_MCP_CONFIG is set to "${path}" but the file could not be read/parsed:`,
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

function loadConfig(): AppConfig {
  const file = loadFileConfig();

  // Resolution order for each setting: explicit env var > config file value.
  const baseUrlRaw = process.env.JIRA_BASE_URL ?? file.baseUrl;
  const userEmail = process.env.JIRA_USER_EMAIL ?? file.userEmail;
  const apiToken = process.env.JIRA_API_TOKEN ?? file.apiToken;
  const projectKey = process.env.JIRA_PROJECT_KEY ?? file.projectKey;

  const missing: string[] = [];
  if (!baseUrlRaw?.trim()) missing.push("baseUrl / JIRA_BASE_URL");
  if (!userEmail?.trim()) missing.push("userEmail / JIRA_USER_EMAIL");
  if (!apiToken?.trim()) missing.push("apiToken / JIRA_API_TOKEN");
  if (!projectKey?.trim()) missing.push("projectKey / JIRA_PROJECT_KEY");

  if (missing.length > 0) {
    log(
      `FATAL: Missing required setting(s): ${missing.join(", ")}.`,
      process.env.JIRA_MCP_CONFIG
        ? "Check your JIRA_MCP_CONFIG file."
        : "Set them via environment variables or point JIRA_MCP_CONFIG at a config file."
    );
    process.exit(1);
  }

  // Strip any trailing slash so we can build paths cleanly.
  const baseUrl = baseUrlRaw!.replace(/\/+$/, "");

  return {
    baseUrl,
    apiBase: `${baseUrl}/rest/api/2`,
    userEmail: userEmail!,
    apiToken: apiToken!,
    projectKey: projectKey!,
    storyIssueType:
      process.env.JIRA_STORY_ISSUE_TYPE ?? file.storyIssueType ?? "Story",
    outlineLinkField:
      process.env.JIRA_OUTLINE_LINK_FIELD ?? file.outlineLinkField,
    storyPointsCustomField:
      process.env.JIRA_STORY_POINTS_FIELD ??
      file.storyPointsField ??
      "customfield_10016",
  };
}

/** Singleton config, validated and frozen at import time. */
export const config: AppConfig = Object.freeze(loadConfig());
