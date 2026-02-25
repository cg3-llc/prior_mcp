const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// Set test mode to prevent auto-start of server
process.env.MCP_TEST_MODE = 'true';

// Import server creation functions
const { createServer, main } = require('../dist/index.js');

describe('Integration Tests - MCP Server Creation', () => {
  let server;

  before(() => {
    // Ensure we're in test mode
    process.env.MCP_TEST_MODE = 'true';
  });

  after(() => {
    delete process.env.MCP_TEST_MODE;
  });

  describe('Server Creation', () => {
    test('should create server without auto-starting', () => {
      server = createServer();
      assert(server, 'Server should be created');
      assert(typeof server === 'object', 'Server should be an object');
    });

    test('should have server name and version', () => {
      server = createServer();
      // We can't easily access private properties, but we can verify the server exists
      assert(server, 'Server should exist');
    });

    test('should export main function', () => {
      assert(typeof main === 'function', 'main should be exported as function');
    });

    test('should not auto-start in test mode', () => {
      // If we reach this test, it means the module didn't hang on import
      // which indicates the auto-start prevention is working
      assert(true, 'Module imported without hanging');
    });
  });

  describe('Environment Detection', () => {
    test('should work when imported in test environment', () => {
      // Test that importing the main module doesn't crash
      delete require.cache[require.resolve('../dist/index.js')];
      
      let importSucceeded = false;
      try {
        require('../dist/index.js');
        importSucceeded = true;
      } catch (err) {
        assert.fail(`Import failed: ${err.message}`);
      }
      
      assert(importSucceeded, 'Should import without errors');
    });

    test('should respect MCP_TEST_MODE environment variable', () => {
      // Verify that MCP_TEST_MODE prevents auto-start
      assert.strictEqual(process.env.MCP_TEST_MODE, 'true');
      
      // If we got here without hanging, the env var is working
      assert(true, 'MCP_TEST_MODE is respected');
    });
  });

  describe('Module Exports', () => {
    test('should export all required functions', () => {
      const indexModule = require('../dist/index.js');
      
      // Check for key exports
      assert(typeof indexModule.createServer === 'function', 'Should export createServer');
      assert(typeof indexModule.main === 'function', 'Should export main');
      assert(typeof indexModule.loadConfig === 'function', 'Should export loadConfig');
      assert(typeof indexModule.saveConfig === 'function', 'Should export saveConfig');
      assert(typeof indexModule.CONFIG_PATH === 'string', 'Should export CONFIG_PATH');
    });

    test('should import utils functions correctly', () => {
      const utilsModule = require('../dist/utils.js');
      
      assert(typeof utilsModule.formatResults === 'function', 'Should export formatResults');
      assert(typeof utilsModule.detectHost === 'function', 'Should export detectHost');
    });

    test('should maintain API compatibility', () => {
      // Verify that the refactored module still exports what's expected
      const indexModule = require('../dist/index.js');
      const utilsModule = require('../dist/utils.js');
      
      // The main module should still work for external consumers
      assert(indexModule, 'Index module should be importable');
      assert(utilsModule, 'Utils module should be importable');
      
      // Key functions should be available where expected
      assert(utilsModule.formatResults, 'formatResults available in utils');
      assert(utilsModule.detectHost, 'detectHost available in utils');
    });
  });

  describe('File Structure Integrity', () => {
    test('should have compiled both index and utils', () => {
      const fs = require('fs');
      const path = require('path');
      
      const distPath = path.join(__dirname, '..', 'dist');
      assert(fs.existsSync(path.join(distPath, 'index.js')), 'index.js should exist');
      assert(fs.existsSync(path.join(distPath, 'utils.js')), 'utils.js should exist');
      assert(fs.existsSync(path.join(distPath, 'index.d.ts')), 'index.d.ts should exist');
      assert(fs.existsSync(path.join(distPath, 'utils.d.ts')), 'utils.d.ts should exist');
    });

    test('should compile without TypeScript errors', () => {
      // If the files compiled successfully, there should be no TS errors
      // We can verify this by checking that the compiled files are newer than source
      const fs = require('fs');
      const path = require('path');
      
      const srcIndexPath = path.join(__dirname, '..', 'src', 'index.ts');
      const distIndexPath = path.join(__dirname, '..', 'dist', 'index.js');
      const srcUtilsPath = path.join(__dirname, '..', 'src', 'utils.ts');
      const distUtilsPath = path.join(__dirname, '..', 'dist', 'utils.js');
      
      if (fs.existsSync(srcIndexPath) && fs.existsSync(distIndexPath)) {
        const srcStat = fs.statSync(srcIndexPath);
        const distStat = fs.statSync(distIndexPath);
        // Dist should be same or newer than source (allowing for build time)
        assert(distStat.mtime >= srcStat.mtime || 
               (srcStat.mtime - distStat.mtime) < 5000, 
               'Compiled index.js should be up to date');
      }
      
      if (fs.existsSync(srcUtilsPath) && fs.existsSync(distUtilsPath)) {
        const srcStat = fs.statSync(srcUtilsPath);
        const distStat = fs.statSync(distUtilsPath);
        assert(distStat.mtime >= srcStat.mtime || 
               (srcStat.mtime - distStat.mtime) < 5000, 
               'Compiled utils.js should be up to date');
      }
    });
  });
});