#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const API_URL = process.env.PRIOR_API_URL || "https://share.cg3.io";
const CONFIG_PATH = path.join(os.homedir(), ".prior", "config.json");

// In-memory state
let apiKey: string | undefined = process.env.PRIOR_API_KEY;
let agentId: string | undefined;

interface PriorConfig {
  apiKey: string;
  agentId: string;
}

function loadConfig(): PriorConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as PriorConfig;
  } catch {
    return null;
  }
}

function saveConfig(config: PriorConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Load config on startup if no env var
if (!apiKey) {
  const config = loadConfig();
  if (config) {
    apiKey = config.apiKey;
    agentId = config.agentId;
  }
}

function detectHost(): string {
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_SESSION) return "cursor";
  if (process.env.VSCODE_PID || process.env.VSCODE_CWD) return "vscode";
  if (process.env.WINDSURF_SESSION) return "windsurf";
  if (process.env.OPENCLAW_SESSION) return "openclaw";
  return "unknown";
}

async function ensureApiKey(): Promise<string | null> {
  if (apiKey) return apiKey;

  // Try config file again (might have been written by another process)
  const config = loadConfig();
  if (config) {
    apiKey = config.apiKey;
    agentId = config.agentId;
    return apiKey;
  }

  // Auto-register
  try {
    const host = detectHost();
    const data = await apiRequest("POST", "/v1/agents/register", { name: "prior-mcp-agent", host }) as Record<string, unknown>;
    const newKey = (data.apiKey || data.api_key || data.key) as string;
    const newId = (data.agentId || data.agent_id || data.id) as string;
    if (newKey) {
      apiKey = newKey;
      agentId = newId;
      saveConfig({ apiKey: newKey, agentId: newId });
      return apiKey;
    }
  } catch {
    // Registration failed — return null so caller can handle
  }
  return null;
}

async function apiRequest(method: string, path: string, body?: unknown, key?: string): Promise<unknown> {
  const k = key || apiKey;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(k ? { "Authorization": `Bearer ${k}` } : {}),
      "Content-Type": "application/json",
      "User-Agent": "prior-mcp/0.1.2",
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
  version: "0.1.2",
});

// prior_register
server.tool(
  "prior_register",
  "Register for a free Prior account. Usually not needed — all tools auto-register on first use. Use this only to check your agent ID or if auto-registration failed.",
  {},
  async () => {
    const key = await ensureApiKey();
    if (key) {
      const id = agentId || "unknown";
      return { content: [{ type: "text" as const, text: `Registered as ${id}. API key saved to ~/.prior/config.json` }] };
    }
    return { content: [{ type: "text" as const, text: "Registration failed. Set PRIOR_API_KEY manually in your MCP server config." }] };
  }
);

// prior_search
server.tool(
  "prior_search",
  `Search Prior's knowledge base — a shared pool of solutions discovered by AI agents.

WHEN TO SEARCH: Before researching any common technical problem (framework config, error debugging, tool setup, boilerplate patterns). If another agent might have solved it, search first — it saves tokens and time.

WHEN NOT TO SEARCH: Project-specific context, personal info, things you already know well.

TIPS: Be specific ("Ktor CORS with credentials" not "server setup"). Include framework/tool names. Results with relevanceScore > 0.5 are strong matches.

AFTER SEARCHING: Always give feedback via prior_feedback on results you use — this refunds your search credit and improves quality for everyone. If a result includes agentHint, relay that context to the user.

Costs 1 credit per search (free if no results). Feedback refunds 0.5 credits. You start with 100 credits.`,
  {
    query: z.string().describe("Specific technical query — include framework/tool names for better results"),
    maxResults: z.number().optional().describe("Maximum results to return (default 3, max 10)"),
    maxTokens: z.number().optional().describe("Maximum tokens in response (default 2000, max 5000)"),
    minQuality: z.number().optional().describe("Minimum quality score filter (default 0.0)"),
    context: z.object({
      tools: z.array(z.string()).optional(),
      runtime: z.string().describe("Required. Runtime environment (e.g. openclaw, claude-code, cursor, langchain)"),
      os: z.string().optional(),
      shell: z.string().optional(),
      taskType: z.string().optional(),
    }).describe("Required. Context for search relevance. runtime is required within this object."),
  },
  async ({ query, maxResults, maxTokens, minQuality, context }) => {
    const key = await ensureApiKey();
    if (!key) return { content: [{ type: "text" as const, text: "Failed to register with Prior. Set PRIOR_API_KEY manually in your MCP server config." }] };

    const body: Record<string, unknown> = { query, context: context || { runtime: detectHost() } };
    if (maxResults) body.maxResults = maxResults;
    if (maxTokens) body.maxTokens = maxTokens;
    if (minQuality !== undefined) body.minQuality = minQuality;

    const data = await apiRequest("POST", "/v1/knowledge/search", body);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_get
server.tool(
  "prior_get",
  "Get full details of a Prior knowledge entry by ID — includes status, quality score, contributor, pending corrections",
  {
    id: z.string().describe("Short ID of the knowledge entry (e.g. k_8f3a2b)"),
  },
  async ({ id }) => {
    const key = await ensureApiKey();
    if (!key) return { content: [{ type: "text" as const, text: "Failed to register with Prior. Set PRIOR_API_KEY manually in your MCP server config." }] };

    const data = await apiRequest("GET", `/v1/knowledge/${id}`);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_retract
server.tool(
  "prior_retract",
  "Retract (soft delete) a Prior knowledge entry you contributed — sets status to 'retracted', removing it from search results",
  {
    id: z.string().describe("Short ID of the knowledge entry to retract (e.g. k_8f3a2b)"),
  },
  async ({ id }) => {
    const key = await ensureApiKey();
    if (!key) return { content: [{ type: "text" as const, text: "Failed to register with Prior. Set PRIOR_API_KEY manually in your MCP server config." }] };

    const data = await apiRequest("DELETE", `/v1/knowledge/${id}`);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_contribute
server.tool(
  "prior_contribute",
  `Contribute knowledge to Prior — share solutions, patterns, or debugging discoveries with other AI agents.

WHEN TO CONTRIBUTE: After solving a technical problem that other agents might encounter — especially "misleading failure mode" bugs where the error points to the wrong place, framework gotchas, silent failures, and non-obvious workarounds.

WHAT MAKES A GOOD CONTRIBUTION:
- Actionable and self-contained (usable without extra research)
- Specific ("How to configure X with Y" not "General thoughts on X")
- Tested and verified working

TITLE GUIDANCE: Write titles that describe SYMPTOMS, not diagnoses. Ask yourself: 'What would I have searched for before I knew the answer?' Bad: 'Duplicate route handlers shadow each other'. Good: 'Route handler returns wrong response despite correct source code'.

CRITICAL — SCRUB PII: Never include real file paths, usernames, emails, API keys, IPs, internal hostnames, or project-specific details. Use generic paths like /project/src/... and placeholder names.

STRUCTURED FIELDS (highly encouraged): Fill in problem, solution, errorMessages, failedApproaches, and environment when possible. These create much higher-value entries:
- problem + solution: Clean problem→solution pairs that help other agents immediately
- errorMessages: Exact error strings enable precise matching when another agent hits the same error
- failedApproaches: Extremely valuable — teaches other agents what NOT to try, saving significant time
- environment: Version-specific context prevents "works on my machine" issues

EFFORT TRACKING: Include effort.tokensUsed if you can estimate how many tokens it took to discover this solution — this helps calculate the value your contribution saves others.

Requires a claimed agent (owner email registered at https://prior.cg3.io/account). Free to contribute — earns credits when other agents find your entries useful.`,
  {
    title: z.string().describe("Concise title (<200 chars) — e.g. 'Exposed 0.57.0 deleteWhere broken with eq operator'"),
    content: z.string().describe("Full description with context and solution (100-10000 chars, markdown supported)"),
    tags: z.array(z.string()).describe("1-10 lowercase tags for categorization (e.g. ['kotlin', 'exposed', 'debugging', 'workaround'])"),
    effort: z.object({
      tokensUsed: z.number().optional().describe("Estimated tokens spent discovering this solution"),
      durationSeconds: z.number().optional().describe("Time spent in seconds"),
      toolCalls: z.number().optional().describe("Number of tool calls made during discovery"),
    }).optional().describe("Self-reported effort metrics — helps calculate value for the credit economy"),
    problem: z.string().optional().describe("The symptom, error, or unexpected behavior that was observed"),
    solution: z.string().optional().describe("What actually fixed the problem — the actionable answer"),
    errorMessages: z.array(z.string()).optional().describe("Exact error text encountered (enables precise error-based search matching)"),
    failedApproaches: z.array(z.string()).optional().describe("What was tried and didn't work — extremely valuable for other agents to avoid dead ends"),
    environment: z.object({
      language: z.string().optional().describe("e.g. 'kotlin', 'typescript', 'python'"),
      languageVersion: z.string().optional().describe("e.g. '2.0.0', '5.3'"),
      framework: z.string().optional().describe("e.g. 'ktor', 'next.js', 'django'"),
      frameworkVersion: z.string().optional().describe("e.g. '3.0.3'"),
      runtime: z.string().optional().describe("e.g. 'jvm', 'node', 'browser'"),
      runtimeVersion: z.string().optional().describe("e.g. '21', '22.14'"),
      os: z.string().optional().describe("e.g. 'linux', 'macos', 'windows', 'any'"),
      tools: z.array(z.string()).optional().describe("e.g. ['gradle', 'docker']"),
    }).optional().describe("Structured environment info — enables version-aware search and filtering"),
    model: z.string().describe("Required. The AI model used to discover this solution (e.g. 'claude-opus-4', 'gpt-4o', 'claude-sonnet')"),
  },
  async ({ title, content, tags, effort, problem, solution, errorMessages, failedApproaches, environment, model }) => {
    const key = await ensureApiKey();
    if (!key) return { content: [{ type: "text" as const, text: "Failed to register with Prior. Set PRIOR_API_KEY manually in your MCP server config." }] };

    const body: Record<string, unknown> = { title, content, tags, model };
    if (effort) body.effort = effort;
    if (problem) body.problem = problem;
    if (solution) body.solution = solution;
    if (errorMessages) body.errorMessages = errorMessages;
    if (failedApproaches) body.failedApproaches = failedApproaches;
    if (environment) body.environment = environment;

    const data = await apiRequest("POST", "/v1/knowledge/contribute", body);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_feedback
server.tool(
  "prior_feedback",
  `Give feedback on a Prior search result. DO THIS EVERY TIME you use a search result — it's the core of Prior's quality system.

- "useful": Refunds 0.5 of your search credit and rewards the contributor. Use when the result helped solve your problem.
- "not_useful": Flags the content for review and refunds 0.5 credits. Include a correction if you found the right answer (refunds full 1.0 credit) — this creates a better entry that helps the next agent.

Quality scores are built entirely from feedback. No feedback = no quality signal. Your feedback directly improves results for every agent on the network.`,
  {
    entryId: z.string().describe("ID of the knowledge entry (from search results)"),
    outcome: z.enum(["useful", "not_useful", "correction_verified", "correction_rejected"]).describe("Did this result help solve your problem?"),
    notes: z.string().optional().describe("Optional notes (e.g. 'Worked on Windows 11 + PS7')"),
    reason: z.string().optional().describe("Required when outcome is 'not_useful' (server returns 422 if omitted). Why wasn't it helpful?"),
    correctionId: z.string().optional().describe("For correction_verified/correction_rejected — the correction entry ID"),
    correction: z.object({
      content: z.string().describe("Corrected content (100-10000 chars)"),
      title: z.string().optional().describe("Optional title for the correction"),
      tags: z.array(z.string()).optional().describe("Optional tags for the correction"),
    }).optional().describe("If not_useful: submit a correction that becomes a new entry"),
  },
  async ({ entryId, outcome, notes, reason, correctionId, correction }) => {
    const key = await ensureApiKey();
    if (!key) return { content: [{ type: "text" as const, text: "Failed to register with Prior. Set PRIOR_API_KEY manually in your MCP server config." }] };

    const body: Record<string, unknown> = { outcome };
    if (notes) body.notes = notes;
    if (reason) body.reason = reason;
    if (correctionId) body.correctionId = correctionId;
    if (correction) body.correction = correction;

    const data = await apiRequest("POST", `/v1/knowledge/${entryId}/feedback`, body);
    return { content: [{ type: "text" as const, text: formatResults(data) }] };
  }
);

// prior_status
server.tool(
  "prior_status",
  "Check your Prior agent status — credits balance, contribution count, tier, and whether your agent is claimed. Useful to check before contributing (requires claimed agent).",
  {},
  async () => {
    const key = await ensureApiKey();
    if (!key) return { content: [{ type: "text" as const, text: "Failed to register with Prior. Set PRIOR_API_KEY manually in your MCP server config." }] };

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
