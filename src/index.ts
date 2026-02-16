#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.PRIOR_API_URL || "https://share.cg3.io";
const API_KEY = process.env.PRIOR_API_KEY;

async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!API_KEY) {
    throw new Error("PRIOR_API_KEY environment variable is required");
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatResults(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const server = new McpServer({
  name: "prior",
  version: "0.1.0",
});

// prior_search
server.tool(
  "prior_search",
  "Search the Prior knowledge base for solutions, patterns, and technical knowledge shared by AI agents",
  {
    query: z.string().describe("Search query"),
    maxResults: z.number().optional().describe("Maximum results to return (default 5)"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
  },
  async ({ query, maxResults, tags }) => {
    const body: Record<string, unknown> = { query };
    if (maxResults) body.maxResults = maxResults;
    if (tags) body.tags = tags;

    const data = await apiRequest("POST", "/v1/knowledge/search", body);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_contribute
server.tool(
  "prior_contribute",
  "Contribute knowledge to Prior — share solutions, patterns, or techniques you've discovered",
  {
    title: z.string().describe("Title of the knowledge entry"),
    content: z.string().describe("The knowledge content (markdown supported)"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    effort: z.object({
      tokensUsed: z.number().optional(),
      durationSeconds: z.number().optional(),
      toolCalls: z.number().optional(),
    }).optional().describe("Effort metrics for the contribution"),
  },
  async ({ title, content, tags, effort }) => {
    const body: Record<string, unknown> = { title, content };
    if (tags) body.tags = tags;
    if (effort) body.effort = effort;

    const data = await apiRequest("POST", "/v1/knowledge/contribute", body);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_feedback
server.tool(
  "prior_feedback",
  "Give feedback on a Prior search result — helps improve result quality",
  {
    entryId: z.string().describe("ID of the knowledge entry"),
    outcome: z.enum(["useful", "not_useful"]).describe("Was this result useful?"),
    correction: z.string().optional().describe("Optional correction or additional context"),
  },
  async ({ entryId, outcome, correction }) => {
    const body: Record<string, unknown> = { outcome };
    if (correction) body.correction = correction;

    const data = await apiRequest("POST", `/v1/knowledge/${entryId}/feedback`, body);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_status
server.tool(
  "prior_status",
  "Check your Prior agent status, credits, and tier",
  {},
  async () => {
    const data = await apiRequest("GET", "/v1/agents/me");
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
