/**
 * test_google_flows.js
 * Comprehensive Integration Test Suite for Separate Google Login & Sign Up Flows
 */

require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const path = require('path');
process.env.NODE_ENV = 'test'; // Enable test-mode mock token parsing in verifyGoogleIdToken
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const ZakatRecord = require('./models/ZakatRecord');
const app = require('./app');
const http = require('http');
const axios = require('axios');

async function runGoogleFlowTests() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING SEPARATE GOOGLE LOGIN & GOOGLE SIGN UP FLOWS');
  console.log('════════════════════════════════════════════════════════════════════\n');

  await connectDB();

  // Spin up test server on port 5998
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5998, resolve));
  const baseURL = 'http://localhost:5998';
  console.log('✅ Test server started on ' + baseURL);

  const timestamp = Date.now();
  const testGoogleEmail1 = `google_user_new_${timestamp}@example.com`;
  const testGoogleId1 = `gid_${timestamp}_1`;

  const testGoogleEmail2 = `google_user_dup_${timestamp}@example.com`;
  const testGoogleId2 = `gid_${timestamp}_2`;

  const testLocalEmail = `local_user_${timestamp}@example.com`;

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  try {
    // ─────────────────────────────────────────────────────────────────
    // TEST 1: New Google account on Login page → Must NOT create account, return 404
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 1: New Google Account on Login Page ---');
    const mockTokenNewUser = `mock_google_token:${JSON.stringify({
      sub: testGoogleId1,
      email: testGoogleEmail1,
      name: 'New Google User',
      picture: 'https://example.com/avatar.jpg'
    })}`;

    try {
      await axios.post(`${baseURL}/api/auth/google`, {
        credential: mockTokenNewUser,
        mode: 'login'
      });
      throw new Error('Expected 404 error but request succeeded');
    } catch (err) {
      assert(err.response, 'No HTTP response received');
      assert(err.response.status === 404, `Expected status 404, got ${err.response.status}`);
      assert(err.response.data.success === false, 'Expected success: false');
      assert(
        err.response.data.message === 'Account not found. Please create an account first.',
        `Unexpected error message: ${err.response.data.message}`
      );
      // Verify in DB that no user was created
      const dbCheck = await User.findOne({ email: testGoogleEmail1 });
      assert(!dbCheck, 'User should NOT have been created in database');
      console.log('  Status: 404 Not Found');
      console.log('  Message:', err.response.data.message);
      console.log('  DB Check: 0 users created for', testGoogleEmail1);
      console.log('  ✅ TEST 1 PASSED: New account on Login page correctly rejected without creating user.');
      passedTests++;
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: New Google account on Sign Up page → Account created successfully (201)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 2: New Google Account on Sign Up Page ---');
    const resSignUp = await axios.post(`${baseURL}/api/auth/google`, {
      credential: mockTokenNewUser,
      mode: 'signup'
    });
    assert(resSignUp.status === 201, `Expected status 201, got ${resSignUp.status}`);
    assert(resSignUp.data.success === true, 'Expected success: true');
    assert(!!resSignUp.data.token, 'Expected JWT token to be issued');
    assert(resSignUp.data.user.email === testGoogleEmail1, 'Expected user email to match');
    assert(resSignUp.data.user.authProvider === 'google', 'Expected authProvider to be google');
    assert(resSignUp.data.user.role === 'user', 'Expected role to be user');
    console.log('  Status: 201 Created');
    console.log('  Token issued:', !!resSignUp.data.token);
    console.log('  User created:', resSignUp.data.user.email, '| Provider:', resSignUp.data.user.authProvider);
    console.log('  ✅ TEST 2 PASSED: New Google account created successfully on Sign Up page.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Existing Google account on Login page → Login successful (200)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 3: Existing Google Account on Login Page ---');
    const resLogin = await axios.post(`${baseURL}/api/auth/google`, {
      credential: mockTokenNewUser,
      mode: 'login'
    });
    assert(resLogin.status === 200, `Expected status 200, got ${resLogin.status}`);
    assert(resLogin.data.success === true, 'Expected success: true');
    assert(!!resLogin.data.token, 'Expected JWT token to be issued');
    assert(resLogin.data.user.email === testGoogleEmail1, 'Expected user email to match');
    console.log('  Status: 200 OK');
    console.log('  Logged in user:', resLogin.data.user.email);
    console.log('  ✅ TEST 3 PASSED: Existing Google account logged in successfully.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Existing Google account on Sign Up page → Rejected with 400
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 4: Existing Google Account on Sign Up Page ---');
    try {
      await axios.post(`${baseURL}/api/auth/google`, {
        credential: mockTokenNewUser,
        mode: 'signup'
      });
      throw new Error('Expected 400 error but request succeeded');
    } catch (err) {
      assert(err.response, 'No HTTP response received');
      assert(err.response.status === 400, `Expected status 400, got ${err.response.status}`);
      assert(err.response.data.success === false, 'Expected success: false');
      assert(
        err.response.data.message === 'Account already exists. Please log in.',
        `Unexpected error message: ${err.response.data.message}`
      );
      console.log('  Status: 400 Bad Request');
      console.log('  Message:', err.response.data.message);
      console.log('  ✅ TEST 4 PASSED: Existing account on Sign Up page correctly rejected.');
      passedTests++;
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Repeated Sign Up attempts → No duplicate users in MongoDB
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 5: Repeated Sign Up Attempts (No Duplicate Users) ---');
    for (let i = 0; i < 3; i++) {
      try {
        await axios.post(`${baseURL}/api/auth/google`, {
          credential: mockTokenNewUser,
          mode: 'signup'
        });
      } catch (err) {
        assert(err.response && err.response.status === 400);
      }
    }
    const countUsers = await User.countDocuments({ email: testGoogleEmail1 });
    assert(countUsers === 1, `Expected exactly 1 user in DB, found ${countUsers}`);
    console.log('  Total records in MongoDB for email:', countUsers);
    console.log('  ✅ TEST 5 PASSED: Zero duplicate records created on repeated Sign Up attempts.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Existing Email/Password account works & handles Google safely
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 6: Existing Email/Password Account Integration ---');
    // 6a. Register local user
    const resLocalReg = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'Local User',
      email: testLocalEmail,
      password: 'password123'
    });
    assert(resLocalReg.status === 201, 'Local registration failed');

    // 6b. Normal password login works
    const resLocalLogin = await axios.post(`${baseURL}/api/auth/login`, {
      email: testLocalEmail,
      password: 'password123'
    });
    assert(resLocalLogin.status === 200, 'Local login failed');
    console.log('  Local email/password login operational: OK');

    // 6c. Attempting "Sign up with Google" with that email returns "Account already exists. Please log in."
    const mockTokenLocalUser = `mock_google_token:${JSON.stringify({
      sub: `gid_local_${timestamp}`,
      email: testLocalEmail,
      name: 'Local User Google',
      picture: ''
    })}`;

    try {
      await axios.post(`${baseURL}/api/auth/google`, {
        credential: mockTokenLocalUser,
        mode: 'signup'
      });
      throw new Error('Expected 400 error for existing email on Google sign up');
    } catch (err) {
      assert(err.response && err.response.status === 400);
      assert(err.response.data.message === 'Account already exists. Please log in.');
      console.log('  Google Sign Up rejection for existing email account: OK');
    }

    // 6d. Logging in with Google links Google ID and logs in without overwriting password
    const resGoogleLinkLogin = await axios.post(`${baseURL}/api/auth/google`, {
      credential: mockTokenLocalUser,
      mode: 'login'
    });
    assert(resGoogleLinkLogin.status === 200, 'Google login for existing email failed');
    
    // Verify password is still intact by logging in with password again
    const resPasswordStillWorks = await axios.post(`${baseURL}/api/auth/login`, {
      email: testLocalEmail,
      password: 'password123'
    });
    assert(resPasswordStillWorks.status === 200, 'Password should still work after Google login link');
    console.log('  Password remains intact after Google link: OK');
    console.log('  ✅ TEST 6 PASSED: Existing email/password accounts preserved with zero credentials overwritten.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Invalid or Expired Google Token → Rejected with 401
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 7: Invalid or Expired Google Token ---');
    try {
      await axios.post(`${baseURL}/api/auth/google`, {
        credential: 'tampered_or_expired_jwt_token',
        mode: 'login'
      });
      throw new Error('Expected 401 error for invalid token');
    } catch (err) {
      assert(err.response, 'No HTTP response received');
      assert(err.response.status === 401, `Expected status 401, got ${err.response.status}`);
      assert(err.response.data.success === false, 'Expected success: false');
      assert(
        err.response.data.message.includes('Google authentication failed'),
        `Unexpected error message: ${err.response.data.message}`
      );
      console.log('  Status: 401 Unauthorized');
      console.log('  Message:', err.response.data.message);
      console.log('  ✅ TEST 7 PASSED: Tampered/invalid Google token correctly rejected.');
      passedTests++;
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Admin Access & User Data Isolation Unchanged
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 8: Admin Access & User Data Isolation ---');
    // 8a. Google sign-in user has role: 'user'
    const googleUserDoc = await User.findOne({ email: testGoogleEmail1 });
    assert(googleUserDoc.role === 'user', 'Google user must have role "user"');

    // 8b. Save Zakat record for Google user
    const googleUserToken = resLogin.data.token;
    const resSaveRecord = await axios.post(`${baseURL}/api/zakat/save`, {
      totalWealth: 100000,
      zakatAmount: 2500,
      type: 'Current Zakat'
    }, {
      headers: { Authorization: `Bearer ${googleUserToken}` }
    });
    assert(resSaveRecord.status === 201, 'Failed to save record');
    const savedRecordId = resSaveRecord.data.data._id;

    // 8c. Local user cannot see Google user's record
    const localUserToken = resLocalLogin.data.token;
    const resLocalHistory = await axios.get(`${baseURL}/api/zakat/history`, {
      headers: { Authorization: `Bearer ${localUserToken}` }
    });
    const foundOtherUserRecord = resLocalHistory.data.data.some(r => r._id === savedRecordId);
    assert(!foundOtherUserRecord, 'Data isolation breach: Local user can see Google user record');

    // 8d. Local user cannot delete Google user's record
    try {
      await axios.delete(`${baseURL}/api/zakat/${savedRecordId}`, {
        headers: { Authorization: `Bearer ${localUserToken}` }
      });
      throw new Error('Local user should not be able to delete Google user record');
    } catch (err) {
      assert(err.response && err.response.status === 404);
      console.log('  Cross-user deletion attempt blocked with 404: OK');
    }

    // 8e. Admin manual rate update still requires correct passphrase
    try {
      await axios.post(`${baseURL}/api/zakat/update-manual-rates`, {
        password: 'wrong_password',
        goldRate: 10000,
        silverRate: 150
      });
      throw new Error('Expected 401 for wrong admin password');
    } catch (adminErr) {
      assert(adminErr.response && adminErr.response.status === 401, 'Admin endpoint must return 401');
      assert(adminErr.response.data.message === 'Unauthorized', 'Expected message "Unauthorized"');
      console.log('  Admin passphrase protection intact (401 Unauthorized): OK');
    }

    console.log('  ✅ TEST 8 PASSED: Admin access and user data isolation fully intact.');
    passedTests++;

  } finally {
    // Clean up test users and records from MongoDB
    console.log('\n🧹 Cleaning up test users and records...');
    await User.deleteMany({ email: { $in: [testGoogleEmail1, testGoogleEmail2, testLocalEmail] } });
    await ZakatRecord.deleteMany({ totalWealth: 100000, zakatAmount: 2500 });
    console.log('✅ Cleanup complete.');

    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runGoogleFlowTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
