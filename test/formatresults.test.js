const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import formatResults function from compiled utils JS
const { formatResults } = require('../dist/utils.js');

describe('FormatResults - Feedback Nudge Tests', () => {
  
  describe('Feedback nudge generation', () => {
    test('should generate correct feedback nudge for single result', () => {
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

    test('should generate correct feedback nudge for multiple results', () => {
      const data = {
        results: [
          { id: 'k_first', title: 'First Result' },
          { id: 'k_second', title: 'Second Result' },
          { id: 'k_third', title: 'Third Result' }
        ]
      };
      
      const result = formatResults(data);
      
      // Should use first result ID for examples
      assert(result.includes('entryId="k_first"'));
      assert(result.includes('All result IDs: k_first, k_second, k_third'));
    });

    test('should handle results with complex IDs', () => {
      const data = {
        results: [
          { id: 'k_uuid_12345_abcdef', title: 'Complex ID Result' },
          { id: 'k_another_67890_fedcba', title: 'Another Complex ID' }
        ]
      };
      
      const result = formatResults(data);
      
      assert(result.includes('entryId="k_uuid_12345_abcdef"'));
      assert(result.includes('All result IDs: k_uuid_12345_abcdef, k_another_67890_fedcba'));
    });

    test('should NOT generate feedback nudge for empty results', () => {
      const data = {
        results: [],
        meta: { totalResults: 0 }
      };
      
      const result = formatResults(data);
      
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('call prior_feedback'));
      assert(!result.includes('---'));
    });

    test('should NOT generate feedback nudge when results is null', () => {
      const data = {
        results: null,
        meta: { error: 'No results found' }
      };
      
      const result = formatResults(data);
      
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('call prior_feedback'));
    });

    test('should NOT generate feedback nudge when results is not an array', () => {
      const data = {
        results: 'No results found',
        meta: { message: 'Search returned no matches' }
      };
      
      const result = formatResults(data);
      
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('call prior_feedback'));
    });

    test('should NOT generate feedback nudge when no results field exists', () => {
      const data = {
        data: [
          { id: 'k_abc123', title: 'Wrongly nested result' }
        ]
      };
      
      const result = formatResults(data);
      
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('call prior_feedback'));
    });

    test('should handle results where first item has no id', () => {
      const data = {
        results: [
          { title: 'No ID Result', content: 'This has no ID' },
          { id: 'k_second', title: 'Has ID Result' }
        ]
      };
      
      const result = formatResults(data);
      
      // Should not generate feedback nudge when first result has no ID
      assert.strictEqual(result, JSON.stringify(data, null, 2));
      assert(!result.includes('call prior_feedback'));
    });

    test('should handle results where first item has null/empty id', () => {
      const testCases = [
        { id: null, title: 'Null ID' },
        { id: '', title: 'Empty ID' }, 
        { id: undefined, title: 'Undefined ID' }
      ];
      
      for (const firstResult of testCases) {
        const data = {
          results: [
            firstResult,
            { id: 'k_second', title: 'Valid ID' }
          ]
        };
        
        const result = formatResults(data);
        
        // Should not generate feedback nudge when first result has invalid ID
        assert.strictEqual(result, JSON.stringify(data, null, 2));
        assert(!result.includes('call prior_feedback'));
      }
    });

    test('should handle mixed valid/invalid IDs correctly', () => {
      const data = {
        results: [
          { id: 'k_valid1', title: 'Valid Result 1' },
          { title: 'No ID Result' },
          { id: '', title: 'Empty ID Result' },
          { id: 'k_valid2', title: 'Valid Result 2' }
        ]
      };
      
      const result = formatResults(data);
      
      // Should generate feedback nudge since first result has valid ID
      assert(result.includes('entryId="k_valid1"'));
      assert(result.includes('All result IDs: k_valid1, , , k_valid2'));
    });
  });

  describe('Exact format verification', () => {
    test('should match exact feedback format specification', () => {
      const data = {
        results: [{ id: 'k_test123', title: 'Test' }]
      };
      
      const result = formatResults(data);
      const feedbackSection = result.split('\n\n---\n')[1];
      
      const expectedFeedback = 
        'You already paid 1 credit for this search. Get it back — call prior_feedback with ONE of:\n' +
        '  worked: prior_feedback(entryId="k_test123", outcome="useful")\n' +
        '  didn\'t work: prior_feedback(entryId="k_test123", outcome="not_useful", reason="describe why")\n' +
        '  wrong result: prior_feedback(entryId="k_test123", outcome="irrelevant")\n' +
        'All result IDs: k_test123';
      
      assert.strictEqual(feedbackSection, expectedFeedback);
    });

    test('should preserve exact spacing and formatting', () => {
      const data = {
        results: [
          { id: 'k_example1', title: 'Example 1' },
          { id: 'k_example2', title: 'Example 2' }
        ]
      };
      
      const result = formatResults(data);
      
      // Check that spacing is exactly 2 spaces for indentation
      assert(result.includes('  worked: '));
      assert(result.includes('  didn\'t work: '));
      assert(result.includes('  wrong result: '));
      
      // Check separator is exactly ---
      assert(result.includes('\n\n---\n'));
    });

    test('should escape special characters in IDs correctly', () => {
      const data = {
        results: [
          { id: 'k_with"quotes', title: 'Has Quotes' },
          { id: 'k_with\\backslash', title: 'Has Backslash' }
        ]
      };
      
      const result = formatResults(data);
      
      // Should properly handle IDs with special characters
      assert(result.includes('entryId="k_with"quotes"'));
      assert(result.includes('k_with"quotes, k_with\\backslash'));
    });
  });

  describe('Edge cases and robustness', () => {
    test('should handle very large number of results', () => {
      const results = [];
      for (let i = 1; i <= 100; i++) {
        results.push({ id: `k_result${i}`, title: `Result ${i}` });
      }
      
      const data = { results };
      const result = formatResults(data);
      
      // Should use first result for feedback example
      assert(result.includes('entryId="k_result1"'));
      
      // Should list all IDs (verify it doesn't truncate)
      assert(result.includes('k_result1, k_result2'));
      assert(result.includes('k_result99, k_result100'));
    });

    test('should handle Unicode characters in IDs', () => {
      const data = {
        results: [
          { id: 'k_unicode_测试', title: 'Unicode Test' },
          { id: 'k_emoji_🎉', title: 'Emoji Test' }
        ]
      };
      
      const result = formatResults(data);
      
      assert(result.includes('entryId="k_unicode_测试"'));
      assert(result.includes('k_unicode_测试, k_emoji_🎉'));
    });

    test('should handle very long IDs', () => {
      const longId = 'k_' + 'very_long_id_'.repeat(50) + 'end';
      const data = {
        results: [
          { id: longId, title: 'Long ID Test' }
        ]
      };
      
      const result = formatResults(data);
      
      assert(result.includes(`entryId="${longId}"`));
      assert(result.includes(`All result IDs: ${longId}`));
    });

    test('should handle results with additional properties', () => {
      const data = {
        results: [
          {
            id: 'k_test123',
            title: 'Test Result',
            content: 'Full content here',
            relevanceScore: 0.95,
            qualityScore: 0.88,
            tags: ['test', 'example'],
            createdAt: '2026-02-25T18:21:00Z',
            contributor: 'ag_contributor123'
          }
        ],
        meta: {
          query: 'original query',
          totalResults: 1,
          creditsUsed: 1
        }
      };
      
      const result = formatResults(data);
      
      // Should still generate feedback nudge correctly despite extra properties
      assert(result.includes('entryId="k_test123"'));
      assert(result.includes('All result IDs: k_test123'));
      
      // Should preserve all original data in JSON
      const jsonPart = result.split('\n\n---\n')[0];
      const parsedJson = JSON.parse(jsonPart);
      assert.strictEqual(parsedJson.results[0].relevanceScore, 0.95);
      assert.strictEqual(parsedJson.meta.query, 'original query');
    });
  });
});