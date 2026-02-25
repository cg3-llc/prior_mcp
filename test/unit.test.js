const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import utility functions from compiled utils JS
const {
  formatResults,
  detectHost
} = require('../dist/utils.js');

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
});