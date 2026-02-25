const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

// Import functions for edge case testing
const { formatResults, detectHost } = require('../dist/utils.js');

describe('Edge Cases and Boundary Conditions', () => {

  describe('formatResults edge cases', () => {
    test('should handle circular references gracefully', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference

      // formatResults uses JSON.stringify which should throw on circular refs
      assert.throws(() => {
        formatResults(obj);
      }, TypeError);
    });

    test('should handle extremely large objects', () => {
      const largeObj = {
        results: []
      };

      // Create a large object with many results
      for (let i = 0; i < 10000; i++) {
        largeObj.results.push({
          id: `k_large${i}`,
          title: `Large Result ${i}`,
          content: 'x'.repeat(1000) // 1KB per result
        });
      }

      const result = formatResults(largeObj);

      // Should still generate feedback nudge with first ID
      assert(result.includes('entryId="k_large0"'));
      assert(result.includes('All result IDs: k_large0, k_large1'));
    });

    test('should handle objects with non-enumerable properties', () => {
      const obj = { results: [{ id: 'k_test', title: 'Test' }] };
      
      // Add non-enumerable property
      Object.defineProperty(obj, 'hidden', {
        value: 'secret',
        enumerable: false
      });

      const result = formatResults(obj);

      // Should not include hidden property in JSON
      assert(!result.includes('secret'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle objects with symbol properties', () => {
      const symbol = Symbol('test');
      const obj = {
        results: [{ id: 'k_test', title: 'Test' }],
        [symbol]: 'symbol value'
      };

      const result = formatResults(obj);

      // JSON.stringify ignores symbol properties
      assert(!result.includes('symbol value'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle objects with functions', () => {
      const obj = {
        results: [{ id: 'k_test', title: 'Test' }],
        fn: function() { return 'test'; }
      };

      const result = formatResults(obj);

      // JSON.stringify ignores functions
      assert(!result.includes('function'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle Date objects', () => {
      const date = new Date('2026-02-25T18:21:00Z');
      const obj = {
        results: [{ id: 'k_test', title: 'Test', createdAt: date }],
        timestamp: date
      };

      const result = formatResults(obj);

      // Dates should be serialized as ISO strings
      assert(result.includes('2026-02-25T18:21:00.000Z'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle RegExp objects', () => {
      const obj = {
        results: [{ id: 'k_test', title: 'Test' }],
        pattern: /test/gi
      };

      const result = formatResults(obj);

      // RegExp serializes as empty object
      assert(result.includes('"pattern": {}'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle Map and Set objects', () => {
      const map = new Map([['key', 'value']]);
      const set = new Set(['item1', 'item2']);
      
      const obj = {
        results: [{ id: 'k_test', title: 'Test' }],
        map: map,
        set: set
      };

      const result = formatResults(obj);

      // Map and Set serialize as empty objects
      assert(result.includes('"map": {}'));
      assert(result.includes('"set": {}'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle objects with toJSON method', () => {
      const obj = {
        results: [{ id: 'k_test', title: 'Test' }],
        custom: {
          value: 'original',
          toJSON: function() {
            return { value: 'custom serialization' };
          }
        }
      };

      const result = formatResults(obj);

      assert(result.includes('custom serialization'));
      assert(!result.includes('original'));
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle very deeply nested objects', () => {
      let deepObj = { results: [{ id: 'k_test', title: 'Test' }] };
      let current = deepObj;

      // Create 100-level deep nesting
      for (let i = 0; i < 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const result = formatResults(deepObj);

      assert(result.includes('entryId="k_test"'));
      assert(result.includes('"level": 99'));
    });

    test('should handle objects with valueOf method', () => {
      const obj = {
        results: [{ id: 'k_test', title: 'Test' }],
        custom: {
          valueOf: function() { return 42; },
          toString: function() { return 'custom string'; }
        }
      };

      const result = formatResults(obj);

      // JSON.stringify doesn't use valueOf/toString for objects
      assert(result.includes('entryId="k_test"'));
    });

    test('should handle sparse arrays', () => {
      const sparseArray = [];
      sparseArray[0] = { id: 'k_first', title: 'First' };
      sparseArray[5] = { id: 'k_sixth', title: 'Sixth' };
      
      const obj = { results: sparseArray };
      const result = formatResults(obj);

      // Should use first non-undefined element
      assert(result.includes('entryId="k_first"'));
      // Sparse array should have nulls in JSON
      assert(result.includes('null'));
    });
  });

  describe('detectHost edge cases', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should handle undefined environment variables', () => {
      // Delete all relevant environment variables
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;

      assert.strictEqual(detectHost(), 'unknown');
    });

    test('should handle whitespace-only environment variables', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;

      process.env.CURSOR_TRACE_ID = '   ';
      process.env.VSCODE_PID = '\t\n';

      // Whitespace-only strings are truthy in JavaScript
      assert.strictEqual(detectHost(), 'cursor');
    });

    test('should handle numeric environment variables', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;

      process.env.VSCODE_PID = '0'; // Zero is truthy as string

      assert.strictEqual(detectHost(), 'vscode');
    });

    test('should handle very long environment variable values', () => {
      const longValue = 'x'.repeat(10000);
      
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;

      process.env.OPENCLAW_SESSION = longValue;

      assert.strictEqual(detectHost(), 'openclaw');
    });

    test('should handle special characters in environment variables', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.OPENCLAW_SESSION;

      process.env.WINDSURF_SESSION = 'session-with-unicode-🎉-and-special-chars!@#$%';

      assert.strictEqual(detectHost(), 'windsurf');
    });

    test('should handle null-like string values', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;
      delete process.env.WINDSURF_SESSION;
      delete process.env.OPENCLAW_SESSION;

      process.env.CURSOR_TRACE_ID = 'null'; // String "null", not null value

      assert.strictEqual(detectHost(), 'cursor');
    });

    test('should handle case sensitivity', () => {
      // Environment variables are case-sensitive on most systems
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.cursor_trace_id; // lowercase
      delete process.env.VSCODE_PID;
      delete process.env.vscode_pid; // lowercase

      process.env.cursor_trace_id = 'test'; // Wrong case

      assert.strictEqual(detectHost(), 'unknown');
    });

    test('should handle multiple conflicting environment variables', () => {
      // Set all environment variables
      process.env.CURSOR_TRACE_ID = 'cursor-trace';
      process.env.CURSOR_SESSION = 'cursor-session';
      process.env.VSCODE_PID = '12345';
      process.env.VSCODE_CWD = '/vscode/path';
      process.env.WINDSURF_SESSION = 'windsurf-session';
      process.env.OPENCLAW_SESSION = 'openclaw-session';

      // Should prioritize cursor (first in the if-else chain)
      assert.strictEqual(detectHost(), 'cursor');
    });

    test('should handle environment with only lower priority variables', () => {
      delete process.env.CURSOR_TRACE_ID;
      delete process.env.CURSOR_SESSION;
      delete process.env.VSCODE_PID;
      delete process.env.VSCODE_CWD;

      process.env.WINDSURF_SESSION = 'windsurf';
      process.env.OPENCLAW_SESSION = 'openclaw';

      // Should prioritize windsurf over openclaw
      assert.strictEqual(detectHost(), 'windsurf');
    });
  });

  describe('Boundary value testing', () => {
    test('should handle empty string inputs', () => {
      const result = formatResults('');
      assert.strictEqual(result, '""');
    });

    test('should handle zero values', () => {
      const result = formatResults(0);
      assert.strictEqual(result, '0');
    });

    test('should handle negative numbers', () => {
      const result = formatResults(-42);
      assert.strictEqual(result, '-42');
    });

    test('should handle floating point edge cases', () => {
      const testCases = [
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN
      ];

      for (const value of testCases) {
        const result = formatResults(value);
        if (value === Number.POSITIVE_INFINITY) {
          assert.strictEqual(result, 'null');
        } else if (value === Number.NEGATIVE_INFINITY) {
          assert.strictEqual(result, 'null');
        } else if (Number.isNaN(value)) {
          assert.strictEqual(result, 'null');
        } else {
          assert.strictEqual(result, JSON.stringify(value));
        }
      }
    });

    test('should handle very large strings', () => {
      const largeString = 'a'.repeat(1000000); // 1MB string
      const result = formatResults(largeString);
      assert.strictEqual(result, JSON.stringify(largeString));
    });

    test('should handle arrays with maximum length', () => {
      // JavaScript arrays can theoretically have 2^32 - 1 elements
      // But let's test a reasonably large array
      const largeArray = new Array(100000).fill().map((_, i) => i);
      const result = formatResults(largeArray);
      assert(result.includes('99999'));
    });

    test('should handle objects with many properties', () => {
      const manyProps = {};
      for (let i = 0; i < 10000; i++) {
        manyProps[`prop${i}`] = `value${i}`;
      }
      manyProps.results = [{ id: 'k_test', title: 'Test' }];

      const result = formatResults(manyProps);
      assert(result.includes('entryId="k_test"'));
      assert(result.includes('prop9999'));
    });

    test('should handle strings with all types of whitespace', () => {
      const whitespaces = [
        '\t', // tab
        '\n', // newline
        '\r', // carriage return
        '\f', // form feed
        '\v', // vertical tab
        ' ',  // space
        '\u00A0', // non-breaking space
        '\u2028', // line separator
        '\u2029'  // paragraph separator
      ];

      const testString = whitespaces.join('');
      const result = formatResults(testString);
      
      // Should properly escape all whitespace characters
      assert(result.includes('\\t'));
      assert(result.includes('\\n'));
      assert(result.includes('\\r'));
    });

    test('should handle strings with control characters', () => {
      const controlChars = '\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008';
      const result = formatResults(controlChars);
      
      // Should properly escape control characters
      assert(result.includes('\\u0000'));
    });

    test('should handle Unicode edge cases', () => {
      const unicodeTests = [
        '🎉', // emoji
        'café', // accented characters  
        '中文', // CJK characters
        '🏳️‍🌈', // complex emoji with ZWJ
        '𝕳𝖊𝖑𝖑𝖔', // mathematical alphanumeric symbols
        '\uFEFF', // byte order mark
        '‍', // zero-width joiner
        '‌', // zero-width non-joiner
      ];

      for (const testStr of unicodeTests) {
        const result = formatResults(testStr);
        assert.strictEqual(result, JSON.stringify(testStr));
      }
    });
  });

  describe('Memory and performance edge cases', () => {
    test('should handle object with many circular references (should throw)', () => {
      const obj = { results: [{ id: 'k_test', title: 'Test' }] };
      
      // Create many circular references
      for (let i = 0; i < 100; i++) {
        obj[`circular${i}`] = obj;
      }

      assert.throws(() => {
        formatResults(obj);
      }, TypeError);
    });

    test('should handle rapid successive calls', () => {
      const testData = { 
        results: [{ id: 'k_rapid', title: 'Rapid Test' }]
      };

      // Call formatResults many times rapidly
      const results = [];
      for (let i = 0; i < 1000; i++) {
        results.push(formatResults(testData));
      }

      // All results should be identical
      const first = results[0];
      assert(results.every(r => r === first));
      assert(first.includes('entryId="k_rapid"'));
    });

    test('should handle objects with prototype pollution attempts', () => {
      const maliciousObj = JSON.parse('{"__proto__": {"polluted": true}, "results": [{"id": "k_test", "title": "Test"}]}');
      
      const result = formatResults(maliciousObj);
      
      // Should still format correctly
      assert(result.includes('entryId="k_test"'));
      
      // Prototype should not be polluted
      assert.strictEqual(Object.prototype.polluted, undefined);
    });
  });

  describe('Integration edge cases', () => {
    test('should handle mixed valid and invalid data structures', () => {
      const mixedData = {
        results: [
          { id: 'k_valid1', title: 'Valid 1' },
          null, // Invalid entry
          { title: 'No ID' }, // Missing ID
          { id: '', title: 'Empty ID' }, // Empty ID
          { id: 'k_valid2', title: 'Valid 2' }
        ],
        meta: {
          date: new Date('2026-02-25'),
          pattern: /test/,
          map: new Map([['key', 'value']])
        }
      };

      const result = formatResults(mixedData);
      
      // Should use first valid ID for feedback
      assert(result.includes('entryId="k_valid1"'));
      assert(result.includes('All result IDs: k_valid1, , , , k_valid2'));
    });

    test('should handle results with inconsistent schemas', () => {
      const inconsistentData = {
        results: [
          { id: 'k_full', title: 'Full Entry', content: 'Content', score: 0.9 },
          { id: 'k_minimal' }, // Minimal entry
          { id: 'k_extra', title: 'Extra Fields', unknownField: 'unknown', nested: { deep: true } }
        ]
      };

      const result = formatResults(inconsistentData);
      
      assert(result.includes('entryId="k_full"'));
      assert(result.includes('All result IDs: k_full, k_minimal, k_extra'));
      assert(result.includes('"unknownField": "unknown"'));
      assert(result.includes('"deep": true'));
    });
  });
});