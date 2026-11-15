/**
 * test_password_reset.js
 * Comprehensive Test Suite for the Password Reset System & Phase 4.1 Production Delivery Guard
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
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { setMockEmailSender } = require('./services/passwordResetEmailService');

async function runPasswordResetTests() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🔒 TESTING FORGOT PASSWORD & SECURE PASSWORD RESET SYSTEM (PHASE 4.1)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5992, resolve));
  const baseURL = 'http://localhost:5992';
  console.log('✅ Test server started on ' + baseURL);

  const timestamp = Date.now();
  const testRegisteredEmail = `reset_user_${timestamp}@example.com`;
  const originalPassword = 'InitialSecurePassword123!';
  const newPassword = 'NewlyResetPassword456!';
  const googleOnlyEmail = `google_only_${timestamp}@example.com`;

  let lastDispatchedEmail = null;
  setMockEmailSender(async (data) => {
    lastDispatchedEmail = data;
    return { success: true, id: 'mock_msg_' + Date.now() };
  });

  const createdEmails = [testRegisteredEmail, googleOnlyEmail];
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  try {
    // ─────────────────────────────────────────────────────────────────
    // SETUP: Create standard registered user & Google-only user
    // ─────────────────────────────────────────────────────────────────
    console.log('--- Setup: Creating test accounts ---');
    const salt = await bcrypt.genSalt(10);
    const hashedOriginal = await bcrypt.hash(originalPassword, salt);

    const normalUser = new User({
      name: 'Reset Test User',
      email: testRegisteredEmail,
      password: hashedOriginal,
      authProvider: 'local',
      role: 'user'
    });
    await normalUser.save();

    const googleUser = new User({
      name: 'Google Only User',
      email: googleOnlyEmail,
      googleId: `gid_${timestamp}`,
      authProvider: 'google',
      role: 'user'
    });
    await googleUser.save();
    console.log('  Accounts created successfully: (OK)\n');

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Forgot-password request for a registered email (Delivery Active)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('--- Test 1: Forgot Password for Registered Email ---');
    const resForgotReg = await axios.post(
      `${baseURL}/api/auth/forgot-password`,
      { email: testRegisteredEmail },
      { headers: { 'x-bypass-rate-limit': 'true' } }
    );

    assert(resForgotReg.status === 200, 'Expected 200 OK');
    assert(resForgotReg.data.success === true);
    assert(resForgotReg.data.message.includes('If an account exists with this email'), 'Missing generic confirmation message');
    assert(lastDispatchedEmail !== null, 'Email service was not invoked');
    assert(lastDispatchedEmail.email === testRegisteredEmail, 'Recipient email mismatch');
    assert(lastDispatchedEmail.resetUrl.includes('/reset-password/'), 'Reset URL missing token');

    console.log('  Generic 200 response returned: (OK)');
    console.log('  Email dispatched via service abstraction with reset URL: (OK)');
    console.log('  ✅ TEST 1 PASSED: Registered email forgot-password handled cleanly.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Forgot-password request for an unregistered email
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 2: Forgot Password for Unregistered Email (Anti-Enumeration) ---');
    lastDispatchedEmail = null;
    const unregisteredEmail = `unregistered_${timestamp}@example.com`;

    const resForgotUnreg = await axios.post(
      `${baseURL}/api/auth/forgot-password`,
      { email: unregisteredEmail },
      { headers: { 'x-bypass-rate-limit': 'true' } }
    );

    assert(resForgotUnreg.status === 200, 'Expected 200 OK for unregistered email');
    assert(resForgotUnreg.data.success === true);
    assert(resForgotUnreg.data.message.includes('If an account exists with this email'), 'Response must match registered email');
    assert(lastDispatchedEmail === null, 'No email must be sent for unregistered accounts');

    console.log('  Exact same generic message returned to prevent account enumeration: (OK)');
    console.log('  Zero emails dispatched for unregistered address: (OK)');
    console.log('  ✅ TEST 2 PASSED: Anti-enumeration security confirmed.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Token Generation, Expiration & Hashing in MongoDB
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 3: Token Generation & SHA-256 Storage Verification ---');
    lastDispatchedEmail = null;
    await axios.post(
      `${baseURL}/api/auth/forgot-password`,
      { email: testRegisteredEmail },
      { headers: { 'x-bypass-rate-limit': 'true' } }
    );
    const rawTokenFromEmail = lastDispatchedEmail.resetUrl.split('/reset-password/')[1];

    assert(rawTokenFromEmail && rawTokenFromEmail.length === 64, 'Raw token should be 64-char hex string (32 bytes)');

    const userDocInDb = await User.findOne({ email: testRegisteredEmail }).select('+resetPasswordToken +resetPasswordExpires');
    assert(userDocInDb, 'User not found in DB');
    assert(userDocInDb.resetPasswordToken !== rawTokenFromEmail, 'Raw token must NEVER be stored in plaintext in DB');
    
    // Check that DB token equals SHA-256 hash of raw token
    const expectedHash = crypto.createHash('sha256').update(rawTokenFromEmail).digest('hex');
    assert(userDocInDb.resetPasswordToken === expectedHash, 'DB must store SHA-256 hash of token');

    // Check 15-minute expiration
    const now = Date.now();
    const expiryTime = new Date(userDocInDb.resetPasswordExpires).getTime();
    const diffMinutes = (expiryTime - now) / (60 * 1000);
    assert(diffMinutes >= 14 && diffMinutes <= 16, `Expiration should be ~15 mins, got ${diffMinutes} mins`);

    console.log('  Raw token is 64-char cryptographically secure string: (OK)');
    console.log('  MongoDB stores only SHA-256 hash: (OK)');
    console.log('  Expiration verified as 15 minutes: (OK)');
    console.log('  ✅ TEST 3 PASSED: Secure token hashing and expiration verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Successful Password Reset
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 4: Successful Password Reset with Token ---');
    const resResetSuccess = await axios.post(`${baseURL}/api/auth/reset-password/${rawTokenFromEmail}`, {
      password: newPassword
    }, { headers: { 'x-bypass-rate-limit': 'true' } });

    assert(resResetSuccess.status === 200, 'Expected 200 OK for reset');
    assert(resResetSuccess.data.success === true);
    assert(resResetSuccess.data.message.includes('Password has been reset successfully'));

    console.log('  Reset response returned 200 OK: (OK)');
    console.log('  ✅ TEST 4 PASSED: Password reset operation succeeded.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Login with New Password
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 5: Login with the New Password ---');
    const resLoginNew = await axios.post(`${baseURL}/api/auth/login`, {
      email: testRegisteredEmail,
      password: newPassword
    });

    assert(resLoginNew.status === 200, 'Login with new password should succeed');
    assert(resLoginNew.data.success === true);
    assert(!!resLoginNew.data.token, 'Login should issue new JWT');

    console.log('  New password accepted by login controller: (OK)');
    console.log('  New JWT token successfully issued: (OK)');
    console.log('  ✅ TEST 5 PASSED: User can log in with new password.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Rejection of the Old Password
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 6: Rejection of the Old Password ---');
    try {
      await axios.post(`${baseURL}/api/auth/login`, {
        email: testRegisteredEmail,
        password: originalPassword
      });
      throw new Error('Old password should have been rejected');
    } catch (err) {
      assert(err.response?.status === 401, `Expected 401 Unauthorized for old password, got ${err.response?.status}`);
      assert(err.response.data.message === 'Invalid email or password.');
    }

    console.log('  Old password rejected with HTTP 401 Unauthorized: (OK)');
    console.log('  ✅ TEST 6 PASSED: Previous password thoroughly invalidated.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Expired Reset-Token Rejection
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 7: Expired Reset Token Rejection ---');
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHashed = crypto.createHash('sha256').update(expiredRawToken).digest('hex');

    await User.findOneAndUpdate(
      { email: testRegisteredEmail },
      {
        resetPasswordToken: expiredHashed,
        resetPasswordExpires: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      }
    );

    try {
      await axios.post(`${baseURL}/api/auth/reset-password/${expiredRawToken}`, {
        password: 'AnotherNewPassword789!'
      }, { headers: { 'x-bypass-rate-limit': 'true' } });
      throw new Error('Expired token should have been rejected');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400 Bad Request for expired token, got ${err.response?.status}`);
      assert(err.response.data.message === 'Invalid or expired password reset token.');
    }

    console.log('  Expired reset token rejected with 400 Bad Request: (OK)');
    console.log('  ✅ TEST 7 PASSED: Token expiration strictly enforced.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Invalid Reset-Token Rejection
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 8: Invalid Reset Token Rejection ---');
    try {
      await axios.post(`${baseURL}/api/auth/reset-password/completely_fake_invalid_token_xyz`, {
        password: 'AnotherNewPassword789!'
      }, { headers: { 'x-bypass-rate-limit': 'true' } });
      throw new Error('Invalid token should have been rejected');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400 Bad Request for invalid token, got ${err.response?.status}`);
      assert(err.response.data.message === 'Invalid or expired password reset token.');
    }

    console.log('  Malformed/tampered token rejected with 400: (OK)');
    console.log('  ✅ TEST 8 PASSED: Invalid token rejection verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 9: Single-Use Enforcement (Reuse of Consumed Token)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 9: Single-Use Token Enforcement (No Reuse) ---');
    try {
      await axios.post(`${baseURL}/api/auth/reset-password/${rawTokenFromEmail}`, {
        password: 'YetAnotherPassword123!'
      }, { headers: { 'x-bypass-rate-limit': 'true' } });
      throw new Error('Consumed token should have been rejected on second use');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400 for reused token, got ${err.response?.status}`);
      assert(err.response.data.message === 'Invalid or expired password reset token.');
    }

    console.log('  Second use of consumed token rejected with 400: (OK)');
    console.log('  ✅ TEST 9 PASSED: Single-use enforcement verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 10: Google-Only Account Handling
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 10: Google-Only Account Password Reset Request ---');
    try {
      await axios.post(
        `${baseURL}/api/auth/forgot-password`,
        { email: googleOnlyEmail },
        { headers: { 'x-bypass-rate-limit': 'true' } }
      );
      throw new Error('Google-only account should not be issued a password reset');
    } catch (err) {
      assert(err.response?.status === 400, `Expected 400 for Google-only account, got ${err.response?.status}`);
      assert(err.response.data.message.includes('Google Sign-In'), 'Message should direct user to Google Sign-In');
    }

    console.log('  Google-only account safely rejected with guidance to use Google Sign-In: (OK)');
    console.log('  ✅ TEST 10 PASSED: Google account compatibility preserved.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 11: Rate Limiting Enforcement
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 11: Rate Limiting Enforcement ---');
    let rateLimitTriggered = false;
    for (let i = 0; i < 7; i++) {
      try {
        await axios.post(`${baseURL}/api/auth/forgot-password`, {
          email: `rate_limit_test_${i}@example.com`
        }, {
          headers: { 'x-forwarded-for': '198.51.100.99' }
        });
      } catch (err) {
        if (err.response?.status === 429) {
          rateLimitTriggered = true;
          assert(err.response.data.message.includes('Too many password reset requests'));
          break;
        }
      }
    }

    assert(rateLimitTriggered === true, 'Rate limiter did not trigger HTTP 429 after threshold');
    console.log('  HTTP 429 Too Many Requests received when rate threshold was exceeded: (OK)');
    console.log('  ✅ TEST 11 PASSED: Rate limiting protects against brute force and abuse.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 12: Existing Google Authentication Regressions
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 12: Google Authentication Regression Verification ---');
    const mockToken = `mock_google_token:${JSON.stringify({
      sub: `gid_${timestamp}`,
      email: googleOnlyEmail,
      name: 'Google Only User',
      picture: ''
    })}`;

    const resGoogleLogin = await axios.post(`${baseURL}/api/auth/google`, {
      credential: mockToken,
      mode: 'login'
    });

    assert(resGoogleLogin.status === 200);
    assert(resGoogleLogin.data.success === true);
    assert(resGoogleLogin.data.user.authProvider === 'google');
    console.log('  Existing Google account login works seamlessly: (OK)');
    console.log('  ✅ TEST 12 PASSED: Google authentication completely intact.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 13: Session Invalidation on Password Reset (JWT Revocation)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 13: Previous Session / JWT Invalidation ---');
    lastDispatchedEmail = null;
    await axios.post(
      `${baseURL}/api/auth/forgot-password`,
      { email: testRegisteredEmail },
      { headers: { 'x-bypass-rate-limit': 'true' } }
    );
    const tokenPart2 = lastDispatchedEmail.resetUrl.split('/reset-password/')[1];

    await new Promise(r => setTimeout(r, 1100));

    await axios.post(`${baseURL}/api/auth/reset-password/${tokenPart2}`, {
      password: 'FinalUpdatedPassword123!'
    }, { headers: { 'x-bypass-rate-limit': 'true' } });

    try {
      await axios.get(`${baseURL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${resLoginNew.data.token}` }
      });
      throw new Error('Old JWT should have been rejected after password change');
    } catch (err) {
      assert(err.response?.status === 401, 'Old JWT must return 401');
      assert(err.response.data.message.includes('Password was changed recently'), 'Expected password changed revocation message');
    }

    console.log('  Pre-reset JWT successfully revoked by auth middleware: (OK)');
    console.log('  ✅ TEST 13 PASSED: Session revocation on password reset verified.');
    passedTests++;

    // ═════════════════════════════════════════════════════════════════
    // PHASE 4.1: PRODUCTION-SAFE DELIVERY GUARD TESTS
    // ═════════════════════════════════════════════════════════════════

    // Temporarily unset mock email sender to test environment guards directly
    setMockEmailSender(null);

    // ─────────────────────────────────────────────────────────────────
    // TEST 14: Production + EMAIL_PROVIDER=disabled
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 14: Production + EMAIL_PROVIDER=disabled ---');
    const origEnv = process.env.NODE_ENV;
    const origProvider = process.env.EMAIL_PROVIDER;
    const origDevPreview = process.env.ENABLE_DEV_RESET_PREVIEW;

    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'disabled';
    process.env.ENABLE_DEV_RESET_PREVIEW = 'false';

    // Clear any existing reset token on testRegisteredEmail
    await User.findOneAndUpdate({ email: testRegisteredEmail }, {
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined
    });

    try {
      await axios.post(`${baseURL}/api/auth/forgot-password`, {
        email: testRegisteredEmail
      }, { headers: { 'x-forwarded-for': '198.51.100.14', 'x-bypass-rate-limit': 'true' } });
      throw new Error('Should have returned 503 when email delivery is disabled in production');
    } catch (err) {
      assert(err.response?.status === 503, `Expected 503 Service Unavailable, got ${err.response?.status}`);
      assert(err.response.data.success === false, 'Expected success: false');
      assert(
        err.response.data.message === 'Password reset via email is temporarily unavailable. Please contact support or try again later.',
        `Unexpected error message: ${err.response.data.message}`
      );
      assert(!err.response.data.resetUrl, 'Must NEVER expose resetUrl in response');
      assert(!err.response.data.token, 'Must NEVER expose token in response');
    }

    // Verify ZERO reset token was generated in MongoDB
    const userAfter503 = await User.findOne({ email: testRegisteredEmail }).select('+resetPasswordToken +resetPasswordExpires');
    assert(!userAfter503.resetPasswordToken, 'Reset token must NOT be generated when email delivery is disabled');
    assert(!userAfter503.resetPasswordExpires, 'Reset expiry must NOT be generated when email delivery is disabled');

    console.log('  Returned HTTP 503 Service Unavailable with clear user-friendly explanation: (OK)');
    console.log('  Zero reset tokens generated or saved in MongoDB: (OK)');
    console.log('  Zero reset URLs or tokens exposed in response: (OK)');
    console.log('  ✅ TEST 14 PASSED: Production disabled-delivery guard verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 15: Development + ENABLE_DEV_RESET_PREVIEW=true
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 15: Development + ENABLE_DEV_RESET_PREVIEW=true ---');
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER = 'disabled';
    process.env.ENABLE_DEV_RESET_PREVIEW = 'true';

    // Capture console output to verify preview logging
    let devPreviewLogged = false;
    const origLog = console.log;
    console.log = (...args) => {
      const line = args.join(' ');
      if (line.includes('[DevResetPreview]')) {
        devPreviewLogged = true;
      }
      origLog(...args);
    };

    const resDevPreview = await axios.post(`${baseURL}/api/auth/forgot-password`, {
      email: testRegisteredEmail
    }, { headers: { 'x-forwarded-for': '198.51.100.15', 'x-bypass-rate-limit': 'true' } });

    console.log = origLog; // restore console

    assert(resDevPreview.status === 200, 'Expected 200 in development with preview enabled');
    assert(resDevPreview.data.success === true);
    assert(devPreviewLogged === true, 'Development preview link was not logged to console');
    assert(!resDevPreview.data.resetUrl, 'Must NOT leak resetUrl in API response even in dev');

    const userWithDevToken = await User.findOne({ email: testRegisteredEmail }).select('+resetPasswordToken');
    assert(!!userWithDevToken.resetPasswordToken, 'Token should be saved in DB for dev testing');

    console.log('  Token generated and preview safely output to server console: (OK)');
    console.log('  API response remains generic without leaking link: (OK)');
    console.log('  ✅ TEST 15 PASSED: Development preview functionality verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 16: Development + ENABLE_DEV_RESET_PREVIEW=false
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 16: Development + ENABLE_DEV_RESET_PREVIEW=false ---');
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_PROVIDER = 'disabled';
    process.env.ENABLE_DEV_RESET_PREVIEW = 'false';

    try {
      await axios.post(`${baseURL}/api/auth/forgot-password`, {
        email: testRegisteredEmail
      }, { headers: { 'x-forwarded-for': '198.51.100.16', 'x-bypass-rate-limit': 'true' } });
      throw new Error('Should have returned 503 when preview is disabled in development');
    } catch (err) {
      assert(err.response?.status === 503, `Expected 503, got ${err.response?.status}`);
      assert(err.response.data.message.includes('temporarily unavailable'));
    }

    console.log('  Returned HTTP 503 when preview is disabled in development: (OK)');
    console.log('  ✅ TEST 16 PASSED: Dev preview disabled state correctly enforced.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 17: Production + ENABLE_DEV_RESET_PREVIEW=true (Strict Guard)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 17: Production + ENABLE_DEV_RESET_PREVIEW=true (Strict Guard) ---');
    // Even if someone accidentally leaves ENABLE_DEV_RESET_PREVIEW=true in production:
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'disabled';
    process.env.ENABLE_DEV_RESET_PREVIEW = 'true';

    try {
      await axios.post(`${baseURL}/api/auth/forgot-password`, {
        email: testRegisteredEmail
      }, { headers: { 'x-forwarded-for': '198.51.100.17', 'x-bypass-rate-limit': 'true' } });
      throw new Error('Production must strictly block dev preview and return 503');
    } catch (err) {
      assert(err.response?.status === 503, `Expected 503 in production, got ${err.response?.status}`);
      assert(err.response.data.message.includes('temporarily unavailable'));
    }

    console.log('  Dev preview strictly ignored when NODE_ENV=production: (OK)');
    console.log('  ✅ TEST 17 PASSED: Production safety override confirmed.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 18: Email Delivery Failure -> Safe DB Token Rollback
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 18: Safe DB Token Rollback on Delivery Failure ---');
    // Restore test environment
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_PROVIDER = 'active_provider';

    // Mock an email sender that fails (e.g. provider network timeout or error)
    setMockEmailSender(async () => {
      return { success: false, reason: 'smtp_connection_refused' };
    });

    try {
      await axios.post(`${baseURL}/api/auth/forgot-password`, {
        email: testRegisteredEmail
      }, { headers: { 'x-forwarded-for': '198.51.100.18', 'x-bypass-rate-limit': 'true' } });
      throw new Error('Should have returned 500 when email delivery failed');
    } catch (err) {
      assert(err.response?.status === 500, `Expected 500 on delivery failure, got ${err.response?.status}`);
      assert(err.response.data.message === 'Failed to send password reset email. Please try again later.');
    }

    // Verify token was rolled back and cleared in MongoDB so no dangling valid token remains
    const userAfterFailure = await User.findOne({ email: testRegisteredEmail }).select('+resetPasswordToken +resetPasswordExpires');
    assert(!userAfterFailure.resetPasswordToken, 'Reset token must be wiped from DB when delivery fails');
    assert(!userAfterFailure.resetPasswordExpires, 'Reset expiry must be wiped from DB when delivery fails');

    console.log('  Delivery failure caught safely and returned 500: (OK)');
    console.log('  Dangling reset token completely wiped from MongoDB: (OK)');
    console.log('  ✅ TEST 18 PASSED: Delivery failure rollback verified.');
    passedTests++;

    // Restore environment variables
    process.env.NODE_ENV = origEnv;
    process.env.EMAIL_PROVIDER = origProvider;
    process.env.ENABLE_DEV_RESET_PREVIEW = origDevPreview;

  } finally {
    console.log('\n🧹 Cleaning up test accounts...');
    await User.deleteMany({ email: { $in: createdEmails } });
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

runPasswordResetTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
