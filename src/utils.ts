/**
 * Utility functions for the Prior MCP server
 * Extracted for testing without starting the full MCP server
 */

export function detectHost(): string {
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_SESSION) return "cursor";
  if (process.env.VSCODE_PID || process.env.VSCODE_CWD) return "vscode";
  if (process.env.WINDSURF_SESSION) return "windsurf";
  if (process.env.OPENCLAW_SESSION) return "openclaw";
  return "unknown";
}

export function formatResults(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  // Append feedback nudge for search results
  // Backend wraps in {ok, data: {results: [...]}, error} — unwrap first
  const d = data as Record<string, unknown>;
  const inner = (d?.data as Record<string, unknown>) || d;
  const results = inner?.results;
  if (results && Array.isArray(results) && results.length > 0) {
    const topResult = results[0] as Record<string, unknown>;
    const topId = topResult?.id;
    // Check if the first result has an 'id' property with a meaningful value
    // Exclude null, undefined, and empty string
    if (topResult && 'id' in topResult && topId !== null && topId !== undefined && topId !== '') {
      const ids = (results as Array<Record<string, unknown>>).map(r => r?.id || '').join(", ");
      return json + `\n\n---\nYou already paid 1 credit for this search. Get it back — call prior_feedback with ONE of:\n` +
        `  worked: prior_feedback(entryId="${topId}", outcome="useful")\n` +
        `  didn't work: prior_feedback(entryId="${topId}", outcome="not_useful", reason="describe why")\n` +
        `  wrong result: prior_feedback(entryId="${topId}", outcome="irrelevant")\n` +
        `All result IDs: ${ids}`;
    }
  }
  return json;
}
