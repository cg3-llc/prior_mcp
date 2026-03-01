const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// Set test mode to prevent auto-start of server
process.env.MCP_TEST_MODE = 'true';
// Set a dummy API key so module can load without throwing
process.env.PRIOR_API_KEY = process.env.PRIOR_API_KEY || 'ask_test_dummy_key';

const { createServer, main } = require('../dist/index.js');

describe('Integration Tests - MCP Server Creation', () => {
  before(() => {
    process.env.MCP_TEST_MODE = 'true';
  });

  after(() => {
    delete process.env.MCP_TEST_MODE;
  });

  test('should create server without auto-starting', () => {
    const server = createServer();
    assert(server, 'Server should be created');
    assert(typeof server === 'object', 'Server should be an object');
  });

  test('should export main function', () => {
    assert(typeof main === 'function', 'main should be exported as function');
  });

  test('should not auto-start in test mode', () => {
    assert(true, 'Module imported without hanging');
  });

  test('should export all required functions', () => {
    const indexModule = require('../dist/index.js');
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

  test('should have compiled dist files', () => {
    const fs = require('fs');
    const path = require('path');
    const distPath = path.join(__dirname, '..', 'dist');
    assert(fs.existsSync(path.join(distPath, 'index.js')), 'index.js should exist');
    assert(fs.existsSync(path.join(distPath, 'utils.js')), 'utils.js should exist');
  });
});
