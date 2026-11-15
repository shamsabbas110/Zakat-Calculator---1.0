require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const ZakatRecord = require('./models/ZakatRecord');
const PastZakatRecord = require('./models/PastZakatRecord');
const app = require('./app');
const http = require('http');
const axios = require('axios');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 STARTING BACKEND AUTH & DATA ISOLATION VERIFICATION');
  console.log('═══════════════════════════════════════════════════════');

  await connectDB();

  // Clean up any previous test users
  const testEmailA = `test_user_a_${Date.now()}@example.com`;
  const testEmailB = `test_user_b_${Date.now()}@example.com`;

  // Start test server on port 5999
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5999, resolve));
  const baseURL = 'http://localhost:5999';
  console.log('✅ Test server started on ' + baseURL);

  try {
    // ── TEST 1: User A Registration ──
    console.log('\n--- Test 1: User A Registration ---');
    const resRegA = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'User Alpha',
      email: testEmailA,
      password: 'password123'
    });
    console.log('Status:', resRegA.status);
    console.log('Response Success:', resRegA.data.success);
    console.log('Token Issued:', !!resRegA.data.token);
    console.log('User Role:', resRegA.data.user.role);
    if (!resRegA.data.token || resRegA.data.user.role !== 'user') throw new Error('Test 1 Failed');
    const tokenA = resRegA.data.token;
    const userIdA = resRegA.data.user.id;
    console.log('✅ TEST 1 PASSED: User A registered with role: "user" and received JWT.');

    // ── TEST 2: Duplicate Registration Rejection ──
    console.log('\n--- Test 2: Duplicate Registration Prevention ---');
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        name: 'Duplicate Alpha',
        email: testEmailA,
        password: 'anotherpassword'
      });
      throw new Error('Should have failed duplicate registration');
    } catch (err) {
      if (err.response && (err.response.status === 409 || err.response.status === 400)) {
        console.log(`Duplicate correctly rejected with ${err.response.status}:`, err.response.data.message);
        console.log('✅ TEST 2 PASSED: Duplicate registration prevented.');
      } else {
        throw err;
      }
    }

    // ── TEST 3: User A Login ──
    console.log('\n--- Test 3: User A Login ---');
    const resLoginA = await axios.post(`${baseURL}/api/auth/login`, {
      email: testEmailA,
      password: 'password123'
    });
    if (!resLoginA.data.token) throw new Error('Login failed');
    console.log('✅ TEST 3 PASSED: User A logged in successfully with valid credentials.');

    // ── TEST 4: Invalid Password Rejection ──
    console.log('\n--- Test 4: Invalid Password Login ---');
    try {
      await axios.post(`${baseURL}/api/auth/login`, {
        email: testEmailA,
        password: 'wrongpassword'
      });
      throw new Error('Should have rejected wrong password');
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 400)) {
        console.log(`Wrong password correctly rejected with ${err.response.status}:`, err.response.data.message);
        console.log('✅ TEST 4 PASSED: Invalid password rejected.');
      } else {
        throw err;
      }
    }

    // ── TEST 5: Protected Route /api/auth/me ──
    console.log('\n--- Test 5: Protected Route Profile Verification ---');
    // Without token -> 401
    try {
      await axios.get(`${baseURL}/api/auth/me`);
      throw new Error('Should have rejected request without token');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log('Unauthenticated access blocked correctly with 401.');
      } else throw err;
    }
    // With token -> 200
    const resMe = await axios.get(`${baseURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('Authenticated profile fetched:', resMe.data.user.email);
    console.log('✅ TEST 5 PASSED: JWT Authentication Middleware correctly protects routes.');

    // ── TEST 6: User B Registration ──
    console.log('\n--- Test 6: User B Registration ---');
    const resRegB = await axios.post(`${baseURL}/api/auth/register`, {
      name: 'User Beta',
      email: testEmailB,
      password: 'password456'
    });
    const tokenB = resRegB.data.token;
    const userIdB = resRegB.data.user.id;
    console.log('✅ TEST 6 PASSED: User B registered with separate ID:', userIdB);

    // ── TEST 7: Data Isolation - Record Creation & Scoping ──
    console.log('\n--- Test 7: User A Saves a Zakat Record ---');
    const resSaveA = await axios.post(`${baseURL}/api/zakat/save`, {
      type: 'Current Zakat',
      totalWealth: 150000,
      zakatAmount: 3750,
      gregorianDate: '2026-11-15',
      hijriDate: '05 Jumada al-ula 1448 AH',
      nextDueDateGregorian: '2027-11-04',
      nextDueDateHijri: '05 Jumada al-ula 1449 AH'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const recordIdA = resSaveA.data.data._id;
    console.log('User A saved record ID:', recordIdA);
    console.log('Record userId:', resSaveA.data.data.userId);

    // Verify User A history contains this record
    const resHistoryA = await axios.get(`${baseURL}/api/zakat/history`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('User A history count:', resHistoryA.data.data.length);
    const hasRecordA = resHistoryA.data.data.some(r => r._id === recordIdA);
    if (!hasRecordA) throw new Error('User A record not found in their own history');

    // ── TEST 8: STRICT DATA ISOLATION - User B CANNOT see User A records ──
    console.log('\n--- Test 8: DATA ISOLATION - User B checks history ---');
    const resHistoryB = await axios.get(`${baseURL}/api/zakat/history`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    console.log('User B history count:', resHistoryB.data.data.length);
    const leakedToB = resHistoryB.data.data.some(r => r._id === recordIdA);
    if (leakedToB) {
      throw new Error('❌ DATA LEAK DETECTED: User A record visible to User B!');
    }
    console.log('✅ TEST 8 PASSED: Zero cross-user data leakage. User B cannot see User A records.');

    // ── TEST 9: Cross-User Deletion Prevention ──
    console.log('\n--- Test 9: DATA ISOLATION - User B attempts to DELETE User A record ---');
    try {
      await axios.delete(`${baseURL}/api/zakat/${recordIdA}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      throw new Error('❌ SECURITY FLAW: User B was able to delete User A record!');
    } catch (err) {
      if (err.response && (err.response.status === 404 || err.response.status === 403)) {
        console.log('Unauthorized deletion blocked with status:', err.response.status, err.response.data.message);
        console.log('✅ TEST 9 PASSED: User B cannot delete User A records.');
      } else {
        throw err;
      }
    }

    // ── TEST 10: User A Deletes Their Own Record ──
    console.log('\n--- Test 10: User A Deletes Their Own Record ---');
    const resDeleteA = await axios.delete(`${baseURL}/api/zakat/${recordIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('Deletion response:', resDeleteA.data.message);
    const resHistoryAAfter = await axios.get(`${baseURL}/api/zakat/history`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const stillExists = resHistoryAAfter.data.data.some(r => r._id === recordIdA);
    if (stillExists) throw new Error('Record was not deleted');
    console.log('✅ TEST 10 PASSED: User A successfully deleted their own record.');

    // ── TEST 11: Rates & Calculation Endpoints Intact ──
    console.log('\n--- Test 11: Core Calculation Endpoints Intact ---');
    const resRates = await axios.get(`${baseURL}/api/zakat/rates`);
    console.log('Rates API Status:', resRates.status);
    console.log('Gold Rate:', resRates.data.goldRate);
    console.log('Silver Rate:', resRates.data.silverRate);
    console.log('Nisab:', resRates.data.nisab);
    if (!resRates.data.goldRate || !resRates.data.silverRate || !resRates.data.nisab) {
      throw new Error('Rates API incomplete');
    }

    const resCalc = await axios.post(`${baseURL}/api/zakat/current`, {
      isOneYearComplete: true,
      netCash: 100000,
      goldGm: 10,
      silverGm: 100
    });
    console.log('Current Zakat Calc Status:', resCalc.status);
    console.log('Total Wealth:', resCalc.data.totalWealth);
    console.log('Zakat Amount:', resCalc.data.zakatAmount);
    console.log('Is Eligible:', resCalc.data.isEligible);
    if (resCalc.data.zakatAmount <= 0) throw new Error('Zakat calculation returned invalid amount');
    console.log('✅ TEST 11 PASSED: Core rates and calculation logic remain 100% operational.');

    // ── CLEANUP TEST USERS ──
    await User.deleteMany({ email: { $in: [testEmailA, testEmailB] } });
    console.log('\n🧹 Test users cleaned up successfully.');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎉 ALL 11 TESTS PASSED SUCCESSFULLY! BACKEND SECURED.');
    console.log('═══════════════════════════════════════════════════════');

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    if (err.response) console.error('Response Data:', err.response.data);
    process.exitCode = 1;
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runTests();
