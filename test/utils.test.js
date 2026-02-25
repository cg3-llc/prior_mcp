const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import utility functions from compiled JS
const { formatResults, detectHost } = require('../dist/utils.js');

describe('Utils - detectHost', () => {
  
  test('should detect cursor environment', () => {
    const originalTraceId = process.env.CURSOR_TRACE_ID;
    const originalSession = process.env.CURSOR_SESSION;
    
    process.env.CURSOR_TRACE_ID = 'test-trace-id';
    const result = detectHost();
    assert.strictEqual(result, 'cursor');
    
    delete process.env.CURSOR_TRACE_ID;
    if (originalTraceId !== undefined) {
      process.env.CURSOR_TRACE_ID = originalTraceId;
    }
    if (originalSession !== undefined) {
      process.env.CURSOR_SESSION = originalSession;
    }
  });

  test('should detect cursor environment via session', () => {
    const originalTraceId = process.env.CURSOR_TRACE_ID;
    const originalSession = process.env.CURSOR_SESSION;
    
    delete process.env.CURSOR_TRACE_ID;
    process.env.CURSOR_SESSION = 'test-session';
    const result = detectHost();
    assert.strictEqual(result, 'cursor');
    
    delete process.env.CURSOR_SESSION;
    if (originalTraceId !== undefined) {
      process.env.CURSOR_TRACE_ID = originalTraceId;
    }
    if (originalSession !== undefined) {
      process.env.CURSOR_SESSION = originalSession;
    }
  });

  test('should detect vscode environment', () => {
    const originalPid = process.env.VSCODE_PID;
    const originalCwd = process.env.VSCODE_CWD;
    const originalCursor = process.env.CURSOR_TRACE_ID;
    
    delete process.env.CURSOR_TRACE_ID;
    process.env.VSCODE_PID = '1234';
    const result = detectHost();
    assert.strictEqual(result, 'vscode');
    
    delete process.env.VSCODE_PID;
    if (originalPid !== undefined) {
      process.env.VSCODE_PID = originalPid;
    }
    if (originalCwd !== undefined) {
      process.env.VSCODE_CWD = originalCwd;
    }
    if (originalCursor !== undefined) {
      process.env.CURSOR_TRACE_ID = originalCursor;
    }
  });

  test('should detect vscode environment via cwd', () => {
    const originalPid = process.env.VSCODE_PID;
    const originalCwd = process.env.VSCODE_CWD;
    const originalCursor = process.env.CURSOR_TRACE_ID;
    
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.VSCODE_PID;
    process.env.VSCODE_CWD = '/project/path';
    const result = detectHost();
    assert.strictEqual(result, 'vscode');
    
    delete process.env.VSCODE_CWD;
    if (originalPid !== undefined) {
      process.env.VSCODE_PID = originalPid;
    }
    if (originalCwd !== undefined) {
      process.env.VSCODE_CWD = originalCwd;
    }
    if (originalCursor !== undefined) {
      process.env.CURSOR_TRACE_ID = originalCursor;
    }
  });

  test('should detect windsurf environment', () => {
    const originalCursor = process.env.CURSOR_TRACE_ID;
    const originalVscode = process.env.VSCODE_PID;
    const originalWindsurf = process.env.WINDSURF_SESSION;
    
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.VSCODE_PID;
    process.env.WINDSURF_SESSION = 'test-windsurf';
    const result = detectHost();
    assert.strictEqual(result, 'windsurf');
    
    delete process.env.WINDSURF_SESSION;
    if (originalCursor !== undefined) {
      process.env.CURSOR_TRACE_ID = originalCursor;
    }
    if (originalVscode !== undefined) {
      process.env.VSCODE_PID = originalVscode;
    }
    if (originalWindsurf !== undefined) {
      process.env.WINDSURF_SESSION = originalWindsurf;
    }
  });

  test('should detect openclaw environment', () => {
    const originalCursor = process.env.CURSOR_TRACE_ID;
    const originalVscode = process.env.VSCODE_PID;
    const originalWindsurf = process.env.WINDSURF_SESSION;
    const originalOpenclaw = process.env.OPENCLAW_SESSION;
    
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.VSCODE_PID;
    delete process.env.WINDSURF_SESSION;
    process.env.OPENCLAW_SESSION = 'test-openclaw';
    const result = detectHost();
    assert.strictEqual(result, 'openclaw');
    
    delete process.env.OPENCLAW_SESSION;
    if (originalCursor !== undefined) {
      process.env.CURSOR_TRACE_ID = originalCursor;
    }
    if (originalVscode !== undefined) {
      process.env.VSCODE_PID = originalVscode;
    }
    if (originalWindsurf !== undefined) {
      process.env.WINDSURF_SESSION = originalWindsurf;
    }
    if (originalOpenclaw !== undefined) {
      process.env.OPENCLAW_SESSION = originalOpenclaw;
    }
  });

  test('should return unknown for unrecognized environment', () => {
    const originalCursor = process.env.CURSOR_TRACE_ID;
    const originalVscode = process.env.VSCODE_PID;
    const originalWindsurf = process.env.WINDSURF_SESSION;
    const originalOpenclaw = process.env.OPENCLAW_SESSION;
    
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.VSCODE_PID;
    delete process.env.WINDSURF_SESSION;
    delete process.env.OPENCLAW_SESSION;
    
    const result = detectHost();
    assert.strictEqual(result, 'unknown');
    
    if (originalCursor !== undefined) {
      process.env.CURSOR_TRACE_ID = originalCursor;
    }
    if (originalVscode !== undefined) {
      process.env.VSCODE_PID = originalVscode;
    }
    if (originalWindsurf !== undefined) {
      process.env.WINDSURF_SESSION = originalWindsurf;
    }
    if (originalOpenclaw !== undefined) {
      process.env.OPENCLAW_SESSION = originalOpenclaw;
    }
  });

  test('should prioritize cursor over other environments', () => {
    const originalCursor = process.env.CURSOR_TRACE_ID;
    const originalVscode = process.env.VSCODE_PID;
    
    process.env.CURSOR_TRACE_ID = 'cursor-id';
    process.env.VSCODE_PID = 'vscode-pid';
    
    const result = detectHost();
    assert.strictEqual(result, 'cursor');
    
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.VSCODE_PID;
    if (originalCursor !== undefined) {
      process.env.CURSOR_TRACE_ID = originalCursor;
    }
    if (originalVscode !== undefined) {
      process.env.VSCODE_PID = originalVscode;
    }
  });
});

describe('Utils - formatResults', () => {
  
  test('should format simple data without feedback nudge', () => {
    const data = { message: 'Hello', status: 'ok' };
    const result = formatResults(data);
    assert.strictEqual(result, JSON.stringify(data, null, 2));
  });

  test('should format empty results without feedback nudge', () => {
    const data = { results: [], meta: { totalResults: 0 } };
    const result = formatResults(data);
    assert.strictEqual(result, JSON.stringify(data, null, 2));
  });

  test('should format null results without feedback nudge', () => {
    const data = { results: null };
    const result = formatResults(data);
    assert.strictEqual(result, JSON.stringify(data, null, 2));
  });

  test('should format results without id without feedback nudge', () => {
    const data = { 
      results: [{ title: 'No ID result', content: 'test' }] 
    };
    const result = formatResults(data);
    assert.strictEqual(result, JSON.stringify(data, null, 2));
  });

  test('should generate feedback nudge for single result', () => {
    const data = {
      results: [
        { 
          id: 'k_abc123', 
          title: 'Single Test Result',
          content: 'This is the content',
          relevanceScore: 0.95 
        }
      ],
      meta: { totalResults: 1, creditsUsed: 1 }
    };
    
    const result = formatResults(data);
    const lines = result.split('\n');
    
    // Check JSON part
    const jsonPart = lines.slice(0, -7).join('\n'); // Remove feedback section
    assert.strictEqual(jsonPart, JSON.stringify(data, null, 2));
    
    // Check feedback section
    assert(result.includes('---'));
    assert(result.includes('You already paid 1 credit for this search'));
    assert(result.includes('call prior_feedback with ONE of:'));
    assert(result.includes('worked: prior_feedback(entryId="k_abc123", outcome="useful")'));
    assert(result.includes('didn\'t work: prior_feedback(entryId="k_abc123", outcome="not_useful", reason="describe why")'));
    assert(result.includes('wrong result: prior_feedback(entryId="k_abc123", outcome="irrelevant")'));
    assert(result.includes('All result IDs: k_abc123'));
  });

  test('should generate feedback nudge for multiple results', () => {
    const data = {
      results: [
        { id: 'k_first', title: 'First Result' },
        { id: 'k_second', title: 'Second Result' },
        { id: 'k_third', title: 'Third Result' }
      ]
    };
    
    const result = formatResults(data);
    
    // Should use first result's ID for examples
    assert(result.includes('worked: prior_feedback(entryId="k_first", outcome="useful")'));
    assert(result.includes('didn\'t work: prior_feedback(entryId="k_first", outcome="not_useful", reason="describe why")'));
    assert(result.includes('wrong result: prior_feedback(entryId="k_first", outcome="irrelevant")'));
    
    // Should list all result IDs
    assert(result.includes('All result IDs: k_first, k_second, k_third'));
  });

  test('should handle results with empty string IDs', () => {
    const data = {
      results: [
        { id: '', title: 'Empty ID' },
        { id: 'k_valid', title: 'Valid ID' }
      ]
    };
    
    const result = formatResults(data);
    
    // Should NOT generate feedback when first result has empty string ID
    assert.strictEqual(result, JSON.stringify(data, null, 2));
    assert(!result.includes('call prior_feedback'));
  });

  test('should handle results with mixed valid and invalid IDs', () => {
    const data = {
      results: [
        { id: 'k_valid1', title: 'Valid 1' },
        { title: 'No ID' }, // no id property
        { id: null, title: 'Null ID' },
        { id: 'k_valid2', title: 'Valid 2' }
      ]
    };
    
    const result = formatResults(data);
    
    // Should handle mixed IDs gracefully
    assert(result.includes('All result IDs: k_valid1, , , k_valid2'));
  });

  test('should handle complex nested data structures', () => {
    const data = {
      results: [
        {
          id: 'k_complex',
          title: 'Complex Result',
          nested: {
            data: {
              values: [1, 2, 3],
              metadata: { score: 0.95 }
            }
          },
          array: ['a', 'b', 'c']
        }
      ],
      metadata: {
        searchQuery: 'test query',
        timing: { searchMs: 250, formatMs: 5 }
      }
    };
    
    const result = formatResults(data);
    
    // Should preserve JSON formatting
    assert(result.includes('"nested": {'));
    assert(result.includes('"values": ['));
    assert(result.includes('1,'));
    assert(result.includes('2,'));
    assert(result.includes('3'));
    
    // Should still add feedback nudge
    assert(result.includes('worked: prior_feedback(entryId="k_complex", outcome="useful")'));
  });

  test('should handle non-object data', () => {
    const stringData = 'simple string';
    const numberData = 42;
    const arrayData = [1, 2, 3];
    
    assert.strictEqual(formatResults(stringData), JSON.stringify(stringData, null, 2));
    assert.strictEqual(formatResults(numberData), JSON.stringify(numberData, null, 2));
    assert.strictEqual(formatResults(arrayData), JSON.stringify(arrayData, null, 2));
  });

  test('should handle undefined and null data', () => {
    assert.strictEqual(formatResults(undefined), JSON.stringify(undefined, null, 2));
    assert.strictEqual(formatResults(null), JSON.stringify(null, null, 2));
  });
});