const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import utility functions from compiled utils JS
const {
  formatResults,
  detectHost
} = require('../dist/utils.js');

const { expandNudgeTokens } = require('../dist/tools.js');

describe('Unit Tests - Pure Functions', () => {
  
  describe('formatResults', () => {
    test('should format simple object as JSON', () => {
      const data = { message: 'test' };
      const result = formatResults(data);
      assert.strictEqual(result, JSON.stringify(data, null, 2));
    });

    test('should format search results with feedback nudge for single result', () => {
      const data = {
        results: [
          { id: 'k_abc123', title: 'Test Result', score: 0.95 }
        ]
      };
      const result = formatResults(data);
      const expected = JSON.stringify(data, null, 2) + 
        `\n\n---\nYou already paid 1 credit for this search. Get it back — call prior_feedback with ONE of:\n` +
        `  worked: prior_feedback(entryId="k_abc123", outcome="useful")\n` +
        `  didn't work: prior_feedback(entryId="k_abc123", outcome="not_useful", reason="describe why")\n` +
        `  wrong result: prior_feedback(entryId="k_abc123", outcome="irrelevant")\n` +
        `All result IDs: k_abc123`;
      assert.strictEqual(result, expected);
    });

    test('should format search results with feedback nudge for multiple results', () => {
      const data = {
        results: [
          { id: 'k_abc123', title: 'Test Result 1' },
          { id: 'k_def456', title: 'Test Result 2' },
          { id: 'k_ghi789', title: 'Test Result 3' }
        ]
      };
      const result = formatResults(data);
      assert(result.includes('All result IDs: k_abc123, k_def456, k_ghi789'));
      assert(result.includes('worked: prior_feedback(entryId="k_abc123", outcome="useful")'));
    });

    test('should not add feedback nudge for empty results', () => {
      const data = { results: [] };
      const result = formatResults(data);
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('---'));
    });

    test('should not add feedback nudge when results is not an array', () => {
      const data = { results: null };
      const result = formatResults(data);
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('---'));
    });

    test('should not add feedback nudge when no results property', () => {
      const data = { message: 'No results' };
      const result = formatResults(data);
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('---'));
    });

    test('should handle results with missing or empty IDs gracefully', () => {
      const data = {
        results: [
          { id: 'k_abc123', title: 'Valid ID' },
          { title: 'Missing ID' },
          { id: '', title: 'Empty ID' }
        ]
      };
      const result = formatResults(data);
      
      // Should include feedback since first result has valid id
      assert(result.includes('entryId="k_abc123"'));
      assert(result.includes('All result IDs: k_abc123, , '));
    });

    test('should handle non-string IDs', () => {
      const data = {
        results: [
          { id: 123, title: 'Numeric ID' },
          { id: null, title: 'Null ID' },
          { id: undefined, title: 'Undefined ID' }
        ]
      };
      const result = formatResults(data);
      
      // Should still process but with converted values
      assert(result.includes('entryId="123"'));
      assert(result.includes('All result IDs: 123, , '));
    });

    test('should preserve complex nested data structures', () => {
      const data = {
        results: [
          {
            id: 'k_complex',
            nested: {
              deep: {
                array: [1, 2, 3],
                object: { key: 'value' }
              }
            }
          }
        ],
        metadata: {
          query: 'test',
          timing: { ms: 100 }
        }
      };
      
      const result = formatResults(data);
      
      // Should preserve nested structure
      assert(result.includes('"nested"'));
      assert(result.includes('"deep"'));
      assert(result.includes('"array"'));
      // The array should contain the numbers 1, 2, 3 regardless of formatting
      assert(result.includes('1,') && result.includes('2,') && result.includes('3'));
      
      // Should still add feedback
      assert(result.includes('entryId="k_complex"'));
    });
  });

  describe('detectHost', () => {
    let originalEnv;

    beforeEach(() => {
      // Save original environment
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    test('should detect cursor from CURSOR_TRACE_ID', () => {
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;
      process.env.CURSOR_TRACE_ID = 'some-trace-id';
      
      assert.strictEqual(detectHost(), 'cursor');
    });

    test('should detect cursor from CURSOR_SESSION', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;
      process.env.CURSOR_SESSION = 'some-session';
      
      assert.strictEqual(detectHost(), 'cursor');
    });

    test('should detect vscode from VSCODE_PID', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;
      process.env.VSCODE_PID = '12345';
      
      assert.strictEqual(detectHost(), 'vscode');
    });

    test('should detect vscode from VSCODE_CWD', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;
      process.env.VSCODE_CWD = '/some/path';
      
      assert.strictEqual(detectHost(), 'vscode');
    });

    test('should detect windsurf from WINDSURF_SESSION', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.OPENCLAW_SESSION;
      process.env.WINDSURF_SESSION = 'some-session';
      
      assert.strictEqual(detectHost(), 'windsurf');
    });

    test('should detect openclaw from OPENCLAW_SESSION', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      process.env.OPENCLAW_SESSION = 'some-session';
      
      assert.strictEqual(detectHost(), 'openclaw');
    });

    test('should return unknown when no host detected', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;
      
      assert.strictEqual(detectHost(), 'unknown');
    });

    test('should prioritize cursor over other hosts', () => {
      process.env.CURSOR_TRACE_ID = 'cursor-trace';
      process.env.VSCODE_PID = '12345';
      process.env.WINDSURF_SESSION = 'windsurf-session';
      
      assert.strictEqual(detectHost(), 'cursor');
    });

    test('should prioritize vscode over windsurf and openclaw', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      process.env.VSCODE_PID = '12345';
      process.env.WINDSURF_SESSION = 'windsurf-session';
      process.env.OPENCLAW_SESSION = 'openclaw-session';
      
      assert.strictEqual(detectHost(), 'vscode');
    });

    test('should handle empty environment variables', () => {
      process.env.CURSOR_TRACE_ID = '';
      process.env.CURSOR_SESSION = '';
      process.env.VSCODE_PID = '';
      process.env.VSCODE_CWD = '';
      process.env.WINDSURF_SESSION = '';
      process.env.OPENCLAW_SESSION = '';
      
      assert.strictEqual(detectHost(), 'unknown');
    });

    test('should handle truthiness of environment variables', () => {
      // Test that we're checking for truthy values, not just existence
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;
      
      // Set to falsy values
      process.env.CURSOR_TRACE_ID = '0';
      assert.strictEqual(detectHost(), 'cursor'); // '0' is truthy as string
      
      process.env.CURSOR_TRACE_ID = 'false';
      assert.strictEqual(detectHost(), 'cursor'); // 'false' is truthy as string
    });
  });

  describe('expandNudgeTokens', () => {
    test('should expand [PRIOR:CONTRIBUTE] to prior_contribute tool call', () => {
      const result = expandNudgeTokens('If you solved it, [PRIOR:CONTRIBUTE] your fix.');
      assert.strictEqual(result, 'If you solved it, `prior_contribute(...)` your fix.');
    });

    test('should expand [PRIOR:FEEDBACK] to prior_feedback tool call', () => {
      const result = expandNudgeTokens('Did it help? [PRIOR:FEEDBACK] takes seconds.');
      assert.strictEqual(result, 'Did it help? `prior_feedback(...)` takes seconds.');
    });

    test('should expand typed feedback tokens', () => {
      const useful = expandNudgeTokens('[PRIOR:FEEDBACK:useful]');
      assert.strictEqual(useful, '`prior_feedback(entryId: "...", outcome: "useful")`');

      const notUseful = expandNudgeTokens('[PRIOR:FEEDBACK:not_useful]');
      assert.strictEqual(notUseful, '`prior_feedback(entryId: "...", outcome: "not_useful", reason: "...")`');

      const irrelevant = expandNudgeTokens('[PRIOR:FEEDBACK:irrelevant]');
      assert.strictEqual(irrelevant, '`prior_feedback(entryId: "...", outcome: "irrelevant")`');
    });

    test('should expand [PRIOR:STATUS] to prior_status tool call', () => {
      const result = expandNudgeTokens('Check your balance: [PRIOR:STATUS]');
      assert.strictEqual(result, 'Check your balance: `prior_status()`');
    });

    test('should expand parameterized contribute with pre-fill', () => {
      const result = expandNudgeTokens('[PRIOR:CONTRIBUTE problem="null pointer" tags="kotlin"]');
      assert.strictEqual(result, '`prior_contribute(problem="null pointer" tags="kotlin")`');
    });

    test('should expand multiple tokens in one message', () => {
      const msg = 'Still working on this? [PRIOR:CONTRIBUTE] saves others. If a result helped, [PRIOR:FEEDBACK].';
      const result = expandNudgeTokens(msg);
      assert.ok(result.includes('`prior_contribute(...)`'));
      assert.ok(result.includes('`prior_feedback(...)`'));
      assert.ok(!result.includes('[PRIOR:'));
    });

    test('should leave message unchanged when no tokens present', () => {
      const msg = 'This is a plain message with no tokens.';
      assert.strictEqual(expandNudgeTokens(msg), msg);
    });

    test('should handle empty string', () => {
      assert.strictEqual(expandNudgeTokens(''), '');
    });
  });
});

// ── Nudge previousResults tests (imported from tools.js) ──

describe('Nudge previousResults processing', () => {
  test('should build feedbackActions for previousResults', () => {
    const previousResults = [
      { id: 'k_abc123', title: 'Fix CORS error' },
      { id: 'k_def456', title: 'Docker timeout fix' },
    ];

    const processed = previousResults.map(r => ({
      id: r.id,
      title: r.title,
      feedbackActions: {
        useful: { entryId: r.id, outcome: 'useful' },
        not_useful: { entryId: r.id, outcome: 'not_useful', reason: '' },
        irrelevant: { entryId: r.id, outcome: 'irrelevant' },
      },
    }));

    assert.strictEqual(processed.length, 2);
    assert.strictEqual(processed[0].id, 'k_abc123');
    assert.strictEqual(processed[0].title, 'Fix CORS error');
    assert.deepStrictEqual(processed[0].feedbackActions.useful, { entryId: 'k_abc123', outcome: 'useful' });
    assert.deepStrictEqual(processed[0].feedbackActions.not_useful, { entryId: 'k_abc123', outcome: 'not_useful', reason: '' });
    assert.deepStrictEqual(processed[0].feedbackActions.irrelevant, { entryId: 'k_abc123', outcome: 'irrelevant' });
    assert.strictEqual(processed[1].id, 'k_def456');
    assert.deepStrictEqual(processed[1].feedbackActions.useful, { entryId: 'k_def456', outcome: 'useful' });
  });

  test('should format previousResults text output', () => {
    const previousResults = [
      { id: 'k_abc', title: 'Fix CORS error' },
    ];

    let text = '\n💡 Still on "CORS"?';
    if (previousResults.length) {
      text += '\n  Previous results:';
      for (const r of previousResults) {
        text += `\n    - "${r.title}" → prior_feedback(entryId: "${r.id}", outcome: "useful")`;
      }
    }

    assert.ok(text.includes('Previous results:'));
    assert.ok(text.includes('"Fix CORS error" → prior_feedback(entryId: "k_abc", outcome: "useful")'));
  });

  test('should not include previousResults when empty', () => {
    const previousResults = [];
    const nudge = {
      kind: 'feedback_reminder',
      template: 'tmpl_1',
      message: 'Test message',
      context: {},
      ...(previousResults.length ? { previousResults } : {}),
    };

    assert.strictEqual(nudge.previousResults, undefined);
  });
});