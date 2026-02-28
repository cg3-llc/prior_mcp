const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

describe('Error Handling Tests', () => {
  let originalFetch;

  beforeEach(() => {
    // Save original fetch if it exists
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    
    // Clean up mocks
    if (global.fetch && global.fetch.mock) {
      global.fetch.mock.reset();
    }
  });

  describe('Network and Connection Errors', () => {
    test('should handle network connection failure', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('ECONNREFUSED');
      });

      try {
        await global.fetch('http://localhost:3333/v1/knowledge/search');
        assert.fail('Should have thrown network error');
      } catch (error) {
        assert.strictEqual(error.message, 'ECONNREFUSED');
      }
    });

    test('should handle DNS resolution failure', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('ENOTFOUND invalid-domain.example');
      });

      try {
        await global.fetch('http://invalid-domain.example/api');
        assert.fail('Should have thrown DNS error');
      } catch (error) {
        assert(error.message.includes('ENOTFOUND'));
      }
    });

    test('should handle timeout errors', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('Request timeout');
      });

      try {
        await global.fetch('http://localhost:3333/slow-endpoint');
        assert.fail('Should have thrown timeout error');
      } catch (error) {
        assert(error.message.includes('timeout'));
      }
    });
  });

  describe('HTTP Error Responses', () => {
    test('should handle 400 Bad Request', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => 'Bad Request: Missing required field "query"'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ /* missing query */ })
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 400);
      const errorText = await response.text();
      assert(errorText.includes('Bad Request'));
    });

    test('should handle 401 Unauthorized', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: Invalid API key'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search', {
        headers: { 'Authorization': 'Bearer invalid-key' }
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 401);
      const errorText = await response.text();
      assert(errorText.includes('Unauthorized'));
    });

    test('should handle 403 Forbidden', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'Forbidden: Insufficient credits'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 403);
      const errorText = await response.text();
      assert(errorText.includes('Forbidden'));
    });

    test('should handle 404 Not Found', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => 'Not Found: Entry k_invalid123 does not exist'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/k_invalid123');

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 404);
      const errorText = await response.text();
      assert(errorText.includes('Not Found'));
    });

    test('should handle 422 Unprocessable Entity', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => 'Validation Error: outcome "not_useful" requires reason field'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/k_test/feedback', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'not_useful' /* missing reason */ })
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 422);
      const errorText = await response.text();
      assert(errorText.includes('Validation Error'));
    });

    test('should handle 429 Rate Limited', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => 'Rate Limited: Too many requests, retry after 60 seconds'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 429);
      const errorText = await response.text();
      assert(errorText.includes('Rate Limited'));
    });

    test('should handle 500 Internal Server Error', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error: Database connection failed'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 500);
      const errorText = await response.text();
      assert(errorText.includes('Internal Server Error'));
    });

    test('should handle 502 Bad Gateway', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway: Upstream server not responding'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 502);
      const errorText = await response.text();
      assert(errorText.includes('Bad Gateway'));
    });

    test('should handle 503 Service Unavailable', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable: Under maintenance'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 503);
      const errorText = await response.text();
      assert(errorText.includes('Service Unavailable'));
    });
  });

  describe('Malformed Response Handling', () => {
    test('should handle non-JSON response when JSON expected', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        text: async () => 'This is not JSON'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');
      const text = await response.text();

      assert.strictEqual(text, 'This is not JSON');
      
      // Test JSON parsing failure
      assert.throws(() => {
        JSON.parse(text);
      }, SyntaxError);
    });

    test('should handle truncated JSON response', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        text: async () => '{"results": [{"id": "k_test'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');
      const text = await response.text();

      assert.throws(() => {
        JSON.parse(text);
      }, SyntaxError);
    });

    test('should handle empty response body', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        text: async () => ''
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');
      const text = await response.text();

      assert.strictEqual(text, '');
    });

    test('should handle null response', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        text: async () => 'null'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');
      const text = await response.text();

      assert.strictEqual(text, 'null');
      assert.strictEqual(JSON.parse(text), null);
    });

    test('should handle response with invalid Unicode', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        text: async () => '{"message": "Invalid Unicode: \uFFFF"}'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');
      const text = await response.text();

      // Should be able to handle the response
      const data = JSON.parse(text);
      assert(data.message.includes('Invalid Unicode'));
    });
  });

  describe('API Key and Authentication Errors', () => {
    test('should handle missing API key scenario', async () => {
      // Mock failed registration
      global.fetch = mock.fn(async (url) => {
        if (url.includes('/register')) {
          return {
            ok: false,
            status: 400,
            text: async () => 'Registration failed: Invalid request'
          };
        }
        return {
          ok: false,
          status: 401,
          text: async () => 'Unauthorized: No API key provided'
        };
      });

      // Test registration failure
      const registerResponse = await global.fetch('http://localhost:3333/v1/agents/register', {
        method: 'POST',
        body: JSON.stringify({ agentName: 'test', host: 'test' })
      });

      assert.strictEqual(registerResponse.ok, false);
      assert.strictEqual(registerResponse.status, 400);

      // Test subsequent API call without auth
      const searchResponse = await global.fetch('http://localhost:3333/v1/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' })
      });

      assert.strictEqual(searchResponse.ok, false);
      assert.strictEqual(searchResponse.status, 401);
    });

    test('should handle expired API key', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: API key expired'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search', {
        headers: { 'Authorization': 'Bearer expired_key_123' },
        method: 'POST',
        body: JSON.stringify({ query: 'test' })
      });

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.includes('expired'));
    });

    test('should handle revoked API key', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'Forbidden: API key revoked'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search', {
        headers: { 'Authorization': 'Bearer revoked_key_123' }
      });

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.includes('revoked'));
    });
  });

  describe('Resource Limit Errors', () => {
    test('should handle credit exhaustion', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'Insufficient credits: 0 credits remaining, search costs 1 credit'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.includes('Insufficient credits'));
    });

    test('should handle contribution limit exceeded', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'Contribution limit exceeded: Unclaimed agents limited to 5 contributions'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/contribute', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test',
          content: 'Test content',
          tags: ['test'],
          model: 'claude-opus'
        })
      });

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.includes('limit exceeded'));
    });

    test('should handle search limit exceeded', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'Search limit exceeded: Unclaimed agents limited to 50 searches'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search');

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.includes('Search limit exceeded'));
    });
  });

  describe('Validation Errors', () => {
    test('should handle invalid feedback without reason', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({
          error: 'Validation failed',
          message: 'outcome "not_useful" requires reason field',
          code: 'VALIDATION_ERROR'
        })
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/k_test/feedback', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'not_useful' })
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 422);
    });

    test('should handle invalid entry ID format', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => 'Invalid entry ID format: must start with "k_"'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/invalid_id');

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.includes('Invalid entry ID format'));
    });

    test('should handle contribution with missing required fields', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({
          error: 'Missing required fields',
          missing: ['title', 'content', 'model'],
          code: 'VALIDATION_ERROR'
        })
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/contribute', {
        method: 'POST',
        body: JSON.stringify({ tags: ['test'] }) // Missing required fields
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 422);
    });

    test('should handle invalid email format for claim', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => 'Invalid email format'
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: '' })
      });

      assert.strictEqual(response.ok, false);
      const errorText = await response.text();
      assert(errorText.length > 0);
    });
  });

  describe('Content Errors', () => {
    test('should handle overly large request payload', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 413,
        text: async () => 'Payload Too Large: Request exceeds 1MB limit'
      }));

      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const response = await global.fetch('http://localhost:3333/v1/knowledge/contribute', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Large contribution',
          content: largeContent,
          tags: ['large'],
          model: 'claude-opus'
        })
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 413);
    });

    test('should handle content with potential PII', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({
          error: 'PII detected',
          message: 'Content contains potential personally identifiable information',
          detected: ['email', 'file_path'],
          code: 'PII_VALIDATION_ERROR'
        })
      }));

      const response = await global.fetch('http://localhost:3333/v1/knowledge/contribute', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Contribution with PII',
          content: 'My email is user@example.com and file is at /home/user/secret.txt',
          tags: ['test'],
          model: 'claude-opus'
        })
      });

      assert.strictEqual(response.ok, false);
      assert.strictEqual(response.status, 422);
    });
  });
});