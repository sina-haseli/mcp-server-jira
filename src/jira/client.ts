import axios, { AxiosInstance } from "axios";

import { config } from "../config";

const authHeader =
  "Basic " +
  Buffer.from(`${config.userEmail}:${config.apiToken}`).toString("base64");

function makeClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 30_000,
  });
}

/** Core Jira REST API v2: `${JIRA_BASE_URL}/rest/api/2`. */
export const http: AxiosInstance = makeClient(config.apiBase);

/** Jira Software Agile API: `${JIRA_BASE_URL}/rest/agile/1.0` (boards & sprints). */
export const agile: AxiosInstance = makeClient(`${config.baseUrl}/rest/agile/1.0`);

/** Legacy GreenHopper API: `${JIRA_BASE_URL}/rest/greenhopper/1.0` (burndown charts). */
export const greenhopper: AxiosInstance = makeClient(
  `${config.baseUrl}/rest/greenhopper/1.0`
);

/** Build the human browse URL for an issue key. */
export function browseUrl(issueKey: string): string {
  return `${config.baseUrl}/browse/${issueKey}`;
}
