/**
 * test_health_check.js
 * Verification of the lightweight health check endpoint: GET /api/health
 * Uses in-memory request/response dispatch to verify Express routing,
 * headers, payload structure, and absence of sensitive data without socket dependency.
 */

const assert = require('assert');
const app = require('./app');

console.log('═══════════════════════════════════════════════════════');
console.log('🏥 RUNNING HEALTH CHECK ENDPOINT AUDIT (GET /api/health)');
console.log('═══════════════════════════════════════════════════════\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(description, testFn) {
  totalTests++;
  try {
    await testFn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

/**
 * Lightweight mock dispatcher for Express app
 */
function dispatch(app, reqOptions) {
  return new Promise((resolve) => {
    const headers = {};
    let statusCode = 200;
    let responseBody = null;

    const req = {
      method: reqOptions.method || 'GET',
      url: reqOptions.url || '/',
      headers: reqOptions.headers || {},
      query: {},
      params: {},
    };

    const res = {
      statusCode: 200,
      status: function (code) {
        this.statusCode = code;
        statusCode = code;
        return this;
      },
      setHeader: function (key, val) {
        headers[key.toLowerCase()] = val;
      },
      getHeader: function (key) {
        return headers[key.toLowerCase()];
      },
      json: function (data) {
        this.setHeader('Content-Type', 'application/json');
        responseBody = data;
        resolve({ statusCode, headers, body: responseBody });
      },
      send: function (data) {
        responseBody = data;
        resolve({ statusCode, headers, body: responseBody });
      },
      end: function (data) {
        if (data !== undefined) responseBody = data;
        resolve({ statusCode, headers, body: responseBody });
      }
    };

    app(req, res);
  });
}

async function executeSuite() {
  // Test 1: GET /api/health HTTP Status Code
  await runAsyncTest('GET /api/health returns HTTP 200 status code', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/health' });
    assert.strictEqual(res.statusCode, 200, `Expected 200, received ${res.statusCode}`);
  });

  // Test 2: Content-Type header is JSON
  await runAsyncTest('GET /api/health sets application/json Content-Type', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/health' });
    assert.ok(res.headers['content-type'], 'Missing Content-Type header');
    assert.ok(
      res.headers['content-type'].includes('application/json'),
      `Expected application/json, got ${res.headers['content-type']}`
    );
  });

  // Test 3: Response payload structure matches specification
  await runAsyncTest('GET /api/health payload strictly matches required structure', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/health' });
    assert.deepStrictEqual(res.body, {
      status: 'ok',
      message: 'Zakat Calculator API is running'
    });
  });

  // Test 4: Verify NO extra fields or sensitive data in response
  await runAsyncTest('Zero sensitive data or unexpected keys exposed', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/health' });
    const keys = Object.keys(res.body);
    assert.strictEqual(keys.length, 2, 'Health check payload should only contain exactly 2 keys');
    assert.ok(keys.includes('status'), 'Payload missing "status" field');
    assert.ok(keys.includes('message'), 'Payload missing "message" field');

    const jsonStr = JSON.stringify(res.body);
    const forbiddenPatterns = [
      'password',
      'secret',
      'mongodb',
      'GROQ',
      'token',
      'uri',
      'database',
      'user',
      'admin',
      'process.env'
    ];
    for (const pattern of forbiddenPatterns) {
      assert.strictEqual(
        jsonStr.toLowerCase().includes(pattern.toLowerCase()),
        false,
        `Forbidden pattern "${pattern}" detected in response`
      );
    }
  });

  // Test 5: Verify zero database dependency / overhead
  await runAsyncTest('Endpoint responds synchronously without waiting for MongoDB connection', async () => {
    const start = performance.now();
    const res = await dispatch(app, { method: 'GET', url: '/api/health' });
    const elapsed = performance.now() - start;
    assert.strictEqual(res.statusCode, 200);
    assert.ok(elapsed < 20, `Execution took ${elapsed.toFixed(2)}ms (must be ultra-lightweight < 20ms)`);
  });

  // Test 6: Backward compatibility for existing endpoints
  await runAsyncTest('GET / legacy endpoint remains functional', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'healthy');
  });

  await runAsyncTest('GET /health legacy endpoint remains functional', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/health' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

executeSuite();
