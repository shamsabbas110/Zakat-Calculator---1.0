/**
 * test_auth_validation.js
 * End-to-End Comprehensive Audit & Verification of Email & Password Authentication
 */

require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const path = require('path');
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const app = require('./app');
const http = require('http');
const axios = require('axios');
const bcrypt = require('bcryptjs');

async function runAuthValidationAudit() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🔐 END-TO-END EMAIL & PASSWORD AUTHENTICATION & VALIDATION AUDIT');
  console.log('════════════════════════════════════════════════════════════════════\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5993, resolve));
  const baseURL = 'http://localhost:5993';
  console.log('✅ Test server started on ' + baseURL);

  const timestamp = Date.now();
  const createdEmails = [];
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  try {
    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Full Name Validation (Min 2, Max 80, Reject Whitespace)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 1: Full Name Validation ---');
    
    // 1a. Missing name
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: '',
        email: `valid_email_${timestamp}@example.com`,
        password: 'ValidPassword123!'
      });
      throw new Error('Should have failed on empty name');
    } catch (err) {
      assert(err.response?.status === 400, 'Expected 400 for empty name');
      assert(err.response.data.message === 'Full name is required.');
    }

    // 1b. Whitespace-only name
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: '    ',
        email: `valid_email_${timestamp}@example.com`,
        password: 'ValidPassword123!'
      });
      throw new Error('Should have failed on whitespace-only name');
    } catch (err) {
      assert(err.response?.status === 400, 'Expected 400 for whitespace-only name');
    }

    // 1c. Name < 2 characters
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'A',
        email: `valid_email_${timestamp}@example.com`,
        password: 'ValidPassword123!'
      });
      throw new Error('Should have failed on 1-char name');
    } catch (err) {
      assert(err.response?.status === 400, 'Expected 400 for 1-character name');
      assert(err.response.data.message.includes('at least 2 characters'));
    }

    // 1d. Name > 80 characters
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'A'.repeat(81),
        email: `valid_email_${timestamp}@example.com`,
        password: 'ValidPassword123!'
      });
      throw new Error('Should have failed on name > 80 chars');
    } catch (err) {
      assert(err.response?.status === 400, 'Expected 400 for name > 80 characters');
      assert(err.response.data.message.includes('cannot exceed 80 characters'));
    }

    console.log('  Empty, whitespace, <2, and >80 chars correctly rejected with 400.');
    console.log('  ✅ TEST 1 PASSED: Full Name backend validation enforced.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Email Format Validation (Strict RFC Check)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 2: Email Format Validation ---');
    const invalidEmails = [
      'abc',
      'test@',
      '@gmail.com',
      'user@gmail',
      'user@@gmail.com',
      '   ',
      'missing-at-sign.com'
    ];

    for (const badEmail of invalidEmails) {
      try {
        await axios.post(`${baseURL}/api/auth/register`, {
          name: 'Valid Name',
          email: badEmail,
          password: 'ValidPassword123!'
        });
        throw new Error(`Should have rejected invalid email: "${badEmail}"`);
      } catch (err) {
        assert(err.response?.status === 400, `Expected 400 for invalid email: ${badEmail}`);
        assert(err.response.data.message === 'Please provide a valid email address.');
      }
    }

    console.log('  All invalid formats (abc, test@, @gmail.com, user@gmail, user@@gmail.com) rejected with 400.');
    console.log('  ✅ TEST 2 PASSED: Email format validation strictly enforced.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Password Validation (Min 8, Max 128, Reject Whitespace-Only)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 3: Password Validation ---');

    // 3a. Empty password
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'Valid Name',
        email: `pw_test_${timestamp}@example.com`,
        password: ''
      });
      throw new Error('Should have rejected empty password');
    } catch (err) {
      assert(err.response?.status === 400);
    }

    // 3b. Whitespace-only password
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'Valid Name',
        email: `pw_test_${timestamp}@example.com`,
        password: '        '
      });
      throw new Error('Should have rejected whitespace-only password');
    } catch (err) {
      assert(err.response?.status === 400);
      assert(err.response.data.message.includes('whitespace only'));
    }

    // 3c. Password < 8 characters (e.g. 7 characters)
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'Valid Name',
        email: `pw_test_${timestamp}@example.com`,
        password: 'Pass12!'
      });
      throw new Error('Should have rejected password < 8 characters');
    } catch (err) {
      assert(err.response?.status === 400);
      assert(err.response.data.message.includes('at least 8 characters'));
    }

    // 3d. Password > 128 characters
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'Valid Name',
        email: `pw_test_${timestamp}@example.com`,
        password: 'P'.repeat(129)
      });
      throw new Error('Should have rejected password > 128 characters');
    } catch (err) {
      assert(err.response?.status === 400);
      assert(err.response.data.message.includes('cannot exceed 128 characters'));
    }

    console.log('  Empty, whitespace-only, <8 chars, and >128 chars rejected with 400.');
    console.log('  ✅ TEST 3 PASSED: Password validation enforced.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Duplicate Email Rejection (HTTP 409 Conflict)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 4: Duplicate Email Rejection (409 Conflict) ---');
    const dupEmail = `dup_test_${timestamp}@example.com`;
    createdEmails.push(dupEmail);

    // Initial registration
    const resRegFirst = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'Initial User',
      email: dupEmail,
      password: 'StrongPassword123!'
    });
    assert(resRegFirst.status === 201, 'First registration should succeed with 201');

    // Duplicate attempt
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'Second User',
        email: dupEmail.toUpperCase(), // Test case insensitivity
        password: 'AnotherPassword456!'
      });
      throw new Error('Duplicate registration should have failed');
    } catch (err) {
      assert(err.response?.status === 409, `Expected 409 Conflict, got ${err.response?.status}`);
      assert(err.response.data.message === 'An account with this email is already registered. Please log in.');
    }

    console.log('  Duplicate registration attempt rejected with HTTP 409 Conflict.');
    console.log('  ✅ TEST 4 PASSED: Duplicate registration correctly returns 409.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: CRITICAL BUG VERIFICATION — Signup Then Immediate Login
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 5: Signup Then Immediate Login with Same Credentials ---');
    const testUserEmail = `verified_user_${timestamp}@my-custom-domain.org`;
    const testUserPass = 'My#Secure$Pass2026!';
    createdEmails.push(testUserEmail);

    // 5a. Signup
    const signupRes = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'Brother Zayd',
      email: `  ${testUserEmail.toUpperCase()}  `, // Test whitespace & mixed case normalization
      password: testUserPass
    });

    assert(signupRes.status === 201, 'Signup failed');
    assert(signupRes.data.success === true);
    assert(!!signupRes.data.token, 'Signup did not return token');
    assert(signupRes.data.user.email === testUserEmail, 'Normalized email should be lowercase and trimmed');
    assert(signupRes.data.user.password === undefined, 'Password hash must NEVER be exposed in response');

    // 5b. Immediate Login with EXACT same credentials
    const loginRes = await axios.post(`${baseURL}/api/auth/login`, {
      email: testUserEmail,
      password: testUserPass
    });

    assert(loginRes.status === 200, 'Immediate login failed');
    assert(loginRes.data.success === true);
    assert(!!loginRes.data.token, 'Login did not return token');
    assert(loginRes.data.user.id === signupRes.data.user.id, 'User ID mismatch between signup and login');
    assert(loginRes.data.user.email === testUserEmail);
    assert(loginRes.data.user.password === undefined, 'Password hash must NEVER be exposed in login response');

    // 5c. Login with mixed case & leading/trailing whitespace in email
    const loginMixedRes = await axios.post(`${baseURL}/api/auth/login`, {
      email: `  ${testUserEmail.toUpperCase()}  `,
      password: testUserPass
    });
    assert(loginMixedRes.status === 200, 'Login with mixed-case/spaced email should succeed');

    console.log('  User registered successfully and immediately logged in with exact same credentials.');
    console.log('  Case-insensitive & trimmed email login verified.');
    console.log('  Zero password hashes exposed in responses.');
    console.log('  ✅ TEST 5 PASSED: Signup-then-login failure bug is fully resolved.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Invalid Credentials Security (HTTP 401 Rejection)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 6: Invalid Credentials Rejection (HTTP 401) ---');

    // 6a. Wrong password
    try {
      await axios.post(`${baseURL}/api/auth/login`, {
        email: testUserEmail,
        password: 'WrongPassword999!'
      });
      throw new Error('Wrong password should have failed');
    } catch (err) {
      assert(err.response?.status === 401, `Expected 401 for wrong password, got ${err.response?.status}`);
      assert(err.response.data.message === 'Invalid email or password.');
    }

    // 6b. Non-existent email
    try {
      await axios.post(`${baseURL}/api/auth/login`, {
        email: `non_existent_${timestamp}@example.com`,
        password: testUserPass
      });
      throw new Error('Non-existent email should have failed');
    } catch (err) {
      assert(err.response?.status === 401, `Expected 401 for non-existent email, got ${err.response?.status}`);
      assert(err.response.data.message === 'Invalid email or password.');
    }

    console.log('  Wrong password and non-existent email correctly return HTTP 401.');
    console.log('  Generic security message "Invalid email or password." preserved.');
    console.log('  ✅ TEST 6 PASSED: Login security and 401 status codes verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Password Storage Security in MongoDB (Bcrypt Hashed)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 7: MongoDB Password Storage Security ---');
    const userInDb = await User.findOne({ email: testUserEmail }).select('+password');
    assert(userInDb, 'User not found in DB');
    assert(userInDb.password !== testUserPass, 'Password must NOT be stored in plaintext');
    assert(userInDb.password.startsWith('$2a$') || userInDb.password.startsWith('$2b$'), 'Password must be valid bcrypt hash');
    
    const isBcryptValid = await bcrypt.compare(testUserPass, userInDb.password);
    assert(isBcryptValid === true, 'Stored bcrypt hash must verify against submitted password');

    console.log('  Password securely hashed with bcrypt (Hash prefix: ' + userInDb.password.substring(0, 7) + '...).');
    console.log('  Zero plaintext passwords stored.');
    console.log('  ✅ TEST 7 PASSED: Database password encryption verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Protected Route Access with Issued JWT
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 8: Protected Route Access with Issued JWT ---');
    const meRes = await axios.get(`${baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    assert(meRes.status === 200);
    assert(meRes.data.user.email === testUserEmail);
    assert(meRes.data.user.role === 'user');

    console.log('  JWT decoded and verified by auth middleware for /api/auth/me.');
    console.log('  ✅ TEST 8 PASSED: Protected routes seamlessly accept issued JWT.');
    passedTests++;

  } finally {
    console.log('\n🧹 Cleaning up test accounts...');
    if (createdEmails.length > 0) {
      await User.deleteMany({ email: { $in: createdEmails } });
    }
    console.log('✅ Cleanup complete.');

    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`🎉 AUTHENTICATION AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAuthValidationAudit().catch(err => {
  console.error('Fatal auth validation audit error:', err);
  process.exit(1);
});
