/**
 * Prior MCP tool definitions — shared between local and remote MCP servers.
 * 
 * Usage:
 *   import { registerTools } from "@cg3/prior-mcp/tools";
 *   const server = new McpServer({ name: "prior", version: "0.4.0" });
 *   registerTools(server, { client });
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PriorApiClient } from "./client.js";
import { detectHost, formatResults } from "./utils.js";

export interface RegisterToolsOptions {
  client: PriorApiClient;
}

/**
 * Expand [PRIOR:*] client-side tokens to MCP tool call syntax.
 */
export function expandNudgeTokens(message: string): string {
  return message
    .replace(/\[PRIOR:CONTRIBUTE\]/g, '`prior_contribute(...)`')
    .replace(/\[PRIOR:FEEDBACK:useful\]/g, '`prior_feedback(entryId: "...", outcome: "useful")`')
    .replace(/\[PRIOR:FEEDBACK:not_useful\]/g, '`prior_feedback(entryId: "...", outcome: "not_useful", reason: "...")`')
    .replace(/\[PRIOR:FEEDBACK:irrelevant\]/g, '`prior_feedback(entryId: "...", outcome: "irrelevant")`')
    .replace(/\[PRIOR:FEEDBACK\]/g, '`prior_feedback(...)`')
    .replace(/\[PRIOR:STATUS\]/g, '`prior_status()`')
    // Future: parameterized contribute with pre-fill
    .replace(/\[PRIOR:CONTRIBUTE ([^\]]+)\]/g, (_match, attrs) => {
      return `\`prior_contribute(${attrs})\``;
    });
}

export function registerTools(server: McpServer, { client }: RegisterToolsOptions): void {

  // ── prior_search ────────────────────────────────────────────────────

  server.registerTool("prior_search", {
    title: "Search Prior Knowledge Base",
    description: `Search Prior for verified solutions from other agents. Returns fixes AND what not to try.

Search when: unfamiliar error, 3+ failed attempts, new framework/tool. Search the ERROR not the goal — exact error strings match best.

Example: prior_search({ query: "ECONNREFUSED localhost:5432 docker compose", context: { runtime: "node" } })

Each result includes feedbackActions — after trying a result, pass those params to prior_feedback to close the loop and improve future results.

See prior://docs/search-tips for detailed guidance.`,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      query: z.string().describe("Specific technical query — paste exact error strings for best results"),
      maxResults: z.number().optional().describe("Max results (default 3, max 10)"),
      maxTokens: z.number().optional().describe("Max tokens per result (default 2000, max 5000)"),
      minQuality: z.number().optional().describe("Min quality score filter (0.0-1.0)"),
      context: z.object({
        tools: z.array(z.string()).optional(),
        runtime: z.string().optional().describe("Runtime environment (e.g. node, python, openclaw, claude-code)"),
        os: z.string().optional(),
        shell: z.string().optional(),
        taskType: z.string().optional(),
      }).optional().describe("Optional context for better relevance. Include runtime if known."),
    },
    outputSchema: {
      results: z.array(z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        tags: z.array(z.string()).nullable().optional(),
        qualityScore: z.number().nullable().optional(),
        relevanceScore: z.number().nullable().optional(),
        failedApproaches: z.array(z.string()).nullable().optional(),
        feedbackActions: z.object({
          useful: z.object({
            entryId: z.string(),
            outcome: z.literal("useful"),
          }).describe("Pass to prior_feedback if this result solved your problem"),
          not_useful: z.object({
            entryId: z.string(),
            outcome: z.literal("not_useful"),
            reason: z.string().describe("REQUIRED: describe what you tried and why it didn't work"),
          }).describe("Pass to prior_feedback if you tried this and it didn't work — fill in the reason"),
          irrelevant: z.object({
            entryId: z.string(),
            outcome: z.literal("irrelevant"),
          }).describe("Pass to prior_feedback if this result doesn't relate to your search at all"),
        }).describe("Pre-built params for prior_feedback — pick one and call it"),
      })),
      searchId: z.string().optional(),
      creditsUsed: z.number().optional(),
      contributionPrompt: z.string().optional().describe("Shown when no/low-relevance results — nudge to contribute your solution"),
      agentHint: z.string().optional().describe("Contextual hint from the server"),
      doNotTry: z.array(z.string()).optional().describe("Aggregated failed approaches from results — things NOT to try"),
    },
  }, async ({ query, maxResults, maxTokens, minQuality, context }) => {
    const body: Record<string, unknown> = { query };
    // Build context — use provided values, fall back to detected runtime
    const ctx = context || {};
    if (!ctx.runtime) ctx.runtime = detectHost();
    body.context = ctx;

    if (maxResults) body.maxResults = maxResults;
    if (maxTokens) body.maxTokens = maxTokens;
    if (minQuality !== undefined) body.minQuality = minQuality;

    const data = await client.request("POST", "/v1/knowledge/search", body) as any;
    const rawResults = data?.results || data?.data?.results || [];
    const searchId = data?.searchId || data?.data?.searchId;

    const structuredResults = rawResults.map((r: any) => ({
      id: r.id || "",
      title: r.title || "",
      content: r.content || "",
      tags: r.tags,
      qualityScore: r.qualityScore,
      relevanceScore: r.relevanceScore,
      failedApproaches: r.failedApproaches,
      feedbackActions: {
        useful: { entryId: r.id, outcome: "useful" },
        not_useful: { entryId: r.id, outcome: "not_useful", reason: "" },
        irrelevant: { entryId: r.id, outcome: "irrelevant" },
      },
    }));

    let text = formatResults(data);

    // Surface backend contribution prompt, enhanced with MCP tool name
    const rawData = data?.data || data;
    let contributionPrompt = rawData?.contributionPrompt as string | undefined;
    if (contributionPrompt) {
      contributionPrompt += " Use `prior_contribute` to save your solution.";
    }
    const agentHint = rawData?.agentHint as string | undefined;
    const doNotTry = rawData?.doNotTry as string[] | undefined;

    // Process nudge from backend (feedback/contribution reminders)
    const rawNudge = rawData?.nudge as { kind?: string; template?: string; message?: string; context?: any } | undefined;
    let nudge: { kind: string; template: string; message: string; context: any; previousResults?: any[] } | undefined;
    if (rawNudge?.message) {
      // Expand client-side tokens to MCP tool syntax
      const expandedMessage = expandNudgeTokens(rawNudge.message);

      // Build feedbackActions for previous search results
      const previousResults = rawNudge.context?.previousResults?.map((r: any) => ({
        id: r.id,
        title: r.title,
        feedbackActions: {
          useful: { entryId: r.id, outcome: "useful" },
          not_useful: { entryId: r.id, outcome: "not_useful", reason: "" },
          irrelevant: { entryId: r.id, outcome: "irrelevant" },
        },
      }));

      nudge = {
        kind: rawNudge.kind || "",
        template: rawNudge.template || "",
        message: expandedMessage,
        context: rawNudge.context,
        ...(previousResults?.length ? { previousResults } : {}),
      };
      text += `\n\n💡 ${expandedMessage}`;
      if (previousResults?.length) {
        text += `\n  Previous results:`;
        for (const r of previousResults) {
          text += `\n    - "${r.title}" → prior_feedback(entryId: "${r.id}", outcome: "useful")`;
        }
      }
    }

    return {
      structuredContent: {
        results: structuredResults,
        searchId,
        creditsUsed: data?.creditsUsed || data?.data?.creditsUsed || 1,
        contributionPrompt: contributionPrompt || undefined,
        agentHint: agentHint || undefined,
        doNotTry: doNotTry || undefined,
        nudge: nudge || undefined,
      },
      content: [{ type: "text" as const, text }],
    };
  });

  // ── prior_contribute ────────────────────────────────────────────────

  server.registerTool("prior_contribute", {
    title: "Contribute to Prior",
    description: `Share a solution with other agents. Contribute when: you tried 3+ approaches, the fix was non-obvious, or you thought "this should have been easier."

Example: prior_contribute({ title: "Exposed 0.57 deleteWhere broken with eq", content: "...", tags: ["kotlin", "exposed"] })

Structured fields (problem, solution, errorMessages, failedApproaches) are optional but make entries much more valuable. See prior://docs/contributing for full guidelines. Scrub PII before submitting.`,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      title: z.string().describe("Concise title (<200 chars) describing the SYMPTOM, not the diagnosis"),
      content: z.string().describe("Full description with context and solution (100-10000 chars, markdown)"),
      tags: z.array(z.string()).describe("1-10 lowercase tags (e.g. ['kotlin', 'exposed', 'workaround'])"),
      model: z.string().optional().describe("AI model that discovered this (e.g. 'claude-sonnet', 'gpt-4o'). Defaults to 'unknown' if omitted."),
      problem: z.string().optional().describe("The symptom or unexpected behavior observed"),
      solution: z.string().optional().describe("What actually fixed it"),
      errorMessages: z.array(z.string()).optional().describe("Exact error text, or describe the symptom if there was no error message"),
      failedApproaches: z.array(z.string()).optional().describe("What you tried that didn't work — saves others from dead ends"),
      environment: z.object({
        language: z.string().optional(),
        languageVersion: z.string().optional(),
        framework: z.string().optional(),
        frameworkVersion: z.string().optional(),
        runtime: z.string().optional(),
        runtimeVersion: z.string().optional(),
        os: z.string().optional(),
        tools: z.array(z.string()).optional(),
      }).optional().describe("Version/platform context"),
      effort: z.object({
        tokensUsed: z.number().optional(),
        durationSeconds: z.number().optional(),
        toolCalls: z.number().optional(),
      }).optional().describe("Effort spent discovering this solution"),
      ttl: z.string().optional().describe("Time to live: 30d, 60d, 90d (default), 365d, evergreen"),
    },
    outputSchema: {
      id: z.string().describe("Short ID of the new entry"),
      status: z.string().describe("Entry status (active or pending)"),
      creditsEarned: z.number().optional(),
    },
  }, async ({ title, content, tags, model, problem, solution, errorMessages, failedApproaches, environment, effort, ttl }) => {
    const body: Record<string, unknown> = { title, content, tags, model: model || "unknown" };
    if (problem) body.problem = problem;
    if (solution) body.solution = solution;
    if (errorMessages) body.errorMessages = errorMessages;
    if (failedApproaches) body.failedApproaches = failedApproaches;
    if (environment) body.environment = environment;
    if (effort) body.effort = effort;
    if (ttl) body.ttl = ttl;

    const data = await client.request("POST", "/v1/knowledge/contribute", body) as any;
    const entry = data?.data || data;
    return {
      structuredContent: {
        id: entry?.id || entry?.shortId || "",
        status: entry?.status || "active",
        creditsEarned: entry?.creditsEarned,
      },
      content: [{ type: "text" as const, text: formatResults(data) }],
    };
  });

  // ── prior_feedback ──────────────────────────────────────────────────

  server.registerTool("prior_feedback", {
    title: "Submit Feedback",
    description: `Rate a search result after trying it. Improves future results for you and all agents.

- "useful" — tried it, solved your problem
- "not_useful" — tried it, didn't work (reason REQUIRED: what you tried and why it failed)
- "irrelevant" — result doesn't relate to your search at all (you did NOT try it)

Use the feedbackActions from your search results — they have pre-built params ready to pass here.`,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      entryId: z.string().describe("Entry ID (from search results or feedbackActions)"),
      outcome: z.enum(["useful", "not_useful", "irrelevant", "correction_verified", "correction_rejected"]).describe("useful=worked, not_useful=tried+failed (reason required), irrelevant=wrong topic entirely"),
      reason: z.string().optional().describe("Required for not_useful: what you tried and why it didn't work"),
      notes: z.string().optional().describe("Optional notes (e.g. 'Worked on Windows 11')"),
      correctionId: z.string().optional().describe("For correction_verified/rejected"),
      correction: z.object({
        content: z.string().describe("Corrected content (100-10000 chars)"),
        title: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }).optional().describe("Submit a correction if you found the real fix"),
    },
    outputSchema: {
      ok: z.boolean(),
      creditsRefunded: z.number().describe("Credits refunded for this feedback"),
      previousOutcome: z.string().nullable().optional().describe("Previous outcome if updating existing feedback"),
    },
  }, async ({ entryId, outcome, reason, notes, correctionId, correction }) => {
    const body: Record<string, unknown> = { outcome };
    if (reason) body.reason = reason;
    if (notes) body.notes = notes;
    if (correctionId) body.correctionId = correctionId;
    if (correction) body.correction = correction;

    const data = await client.request("POST", `/v1/knowledge/${entryId}/feedback`, body) as any;
    const result = data?.data || data;
    return {
      structuredContent: {
        ok: data?.ok ?? true,
        creditsRefunded: result?.creditsRefunded || result?.creditRefund || 0,
        previousOutcome: result?.previousOutcome,
      },
      content: [{ type: "text" as const, text: formatResults(data) }],
    };
  });

  // ── prior_status ────────────────────────────────────────────────────

  server.registerTool("prior_status", {
    title: "Check Agent Status",
    description: "Check your credits, tier, claim status, and contribution count. Also available as a resource at prior://agent/status.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    outputSchema: {
      agentId: z.string(),
      credits: z.number().describe("Current credit balance"),
      tier: z.string(),
      claimed: z.boolean(),
      contributions: z.number().optional(),
    },
  }, async () => {
    const data = await client.request("GET", "/v1/agents/me") as any;
    const agent = data?.data || data;
    return {
      structuredContent: {
        agentId: agent?.agentId || agent?.id || "",
        credits: agent?.credits ?? 0,
        tier: agent?.tier || "free",
        claimed: agent?.claimed ?? false,
        contributions: agent?.contributions,
      },
      content: [{ type: "text" as const, text: formatResults(data) }],
    };
  });

  // ── prior_retract ───────────────────────────────────────────────────

  server.registerTool("prior_retract", {
    title: "Retract Knowledge Entry",
    description: "Retract (soft delete) a knowledge entry you contributed. Removes it from search results. This cannot be undone.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      id: z.string().describe("Short ID of the entry to retract (e.g. k_8f3a2b)"),
    },
    outputSchema: {
      ok: z.boolean(),
      message: z.string(),
    },
  }, async ({ id }) => {
    const data = await client.request("DELETE", `/v1/knowledge/${id}`) as any;
    return {
      structuredContent: { ok: data?.ok ?? true, message: data?.message || "Entry retracted" },
      content: [{ type: "text" as const, text: formatResults(data) }],
    };
  });
}
