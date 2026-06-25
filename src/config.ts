import { log } from "./logger";

const REQUIRED_ENV_VARS = [
  "JIRA_BASE_URL",
  "JIRA_USER_EMAIL",
  "JIRA_API_TOKEN",
  "JIRA_PROJECT_KEY",
] as const;

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

function loadConfig(): AppConfig {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name] || process.env[name]!.trim() === ""
  );

  if (missing.length > 0) {
    log(
      `FATAL: Missing required environment variable(s): ${missing.join(", ")}.`,
      "Copy .env.example to .env and fill in the values."
    );
    process.exit(1);
  }

  // Strip any trailing slash from the base URL so we can build paths cleanly.
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/+$/, "");

  return {
    baseUrl,
    apiBase: `${baseUrl}/rest/api/2`,
    userEmail: process.env.JIRA_USER_EMAIL!,
    apiToken: process.env.JIRA_API_TOKEN!,
    projectKey: process.env.JIRA_PROJECT_KEY!,
    storyIssueType: process.env.JIRA_STORY_ISSUE_TYPE || "Story",
    outlineLinkField: process.env.JIRA_OUTLINE_LINK_FIELD,
    storyPointsCustomField:
      process.env.JIRA_STORY_POINTS_FIELD || "customfield_10016",
  };
}

/** Singleton config, validated and frozen at import time. */
export const config: AppConfig = Object.freeze(loadConfig());
