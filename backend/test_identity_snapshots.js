/**
 * test_identity_snapshots.js
 * Integration test suite for User Identity Snapshots in ZakatRecord and PastZakatRecord
 */

require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const path = require('path');
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const ZakatRecord = require('./models/ZakatRecord');
const PastZakatRecord = require('./models/PastZakatRecord');
const app = require('./app');
const http = require('http');
const axios = require('axios');

async function runSnapshotTests() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('📸 TESTING USER IDENTITY SNAPSHOTS (ZakatRecord & PastZakatRecord)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  await connectDB();

  // Start test server on port 5997
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5997, resolve));
  const baseURL = 'http://localhost:5997';
  console.log('✅ Test server started on ' + baseURL);

  const timestamp = Date.now();
  const emailUserA = `user_a_snap_${timestamp}@example.com`;
  const nameUserA = 'Brother Ahmad';

  const emailUserB = `user_b_snap_${timestamp}@example.com`;
  const nameUserB = 'Sister Fatima';

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  let tokenA, userIdA;
  let tokenB, userIdB;
  let recordIdA_Current, recordIdA_Past;
  let recordIdB_Current, recordIdB_Past;
  let legacyRecordId;

  try {
    // Setup Users A and B
    const resRegA = await axios.post(`${baseURL}/api/auth/register`, {
      name: nameUserA,
      email: emailUserA,
      password: 'password123'
    });
    tokenA = resRegA.data.token;
    userIdA = resRegA.data.user.id;

    const resRegB = await axios.post(`${baseURL}/api/auth/register`, {
      name: nameUserB,
      email: emailUserB,
      password: 'password123'
    });
    tokenB = resRegB.data.token;
    userIdB = resRegB.data.user.id;

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: User A saves Current Zakat → correct userId, username, userEmail
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 1: User A Saves Current Zakat (Identity Snapshot) ---');
    const resSaveA_Current = await axios.post(`${baseURL}/api/zakat/save`, {
      totalWealth: 200000,
      zakatAmount: 5000,
      gregorianDate: '2026-11-16',
      hijriDate: '24 Jumada al-ula 1448 AH',
      type: 'Current Zakat'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(resSaveA_Current.status === 201, 'Expected status 201');
    recordIdA_Current = resSaveA_Current.data.data._id;
    
    // Inspect database document directly
    const docA_Current = await ZakatRecord.findById(recordIdA_Current);
    assert(docA_Current, 'Document not found in DB');
    assert(String(docA_Current.userId) === String(userIdA), 'userId mismatch');
    assert(docA_Current.username === nameUserA, `username mismatch: got ${docA_Current.username}`);
    assert(docA_Current.userEmail === emailUserA, `userEmail mismatch: got ${docA_Current.userEmail}`);
    assert(docA_Current.totalWealth === 200000, 'totalWealth mismatch');
    assert(docA_Current.zakatAmount === 5000, 'zakatAmount mismatch');

    console.log('  Stored Record ID:', docA_Current._id);
    console.log('  userId:', docA_Current.userId);
    console.log('  username snapshot:', docA_Current.username);
    console.log('  userEmail snapshot:', docA_Current.userEmail);
    console.log('  ✅ TEST 1 PASSED: User A Current Zakat saved with accurate identity snapshot.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: User B saves Current Zakat → User B details saved
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 2: User B Saves Current Zakat (Identity Snapshot) ---');
    const resSaveB_Current = await axios.post(`${baseURL}/api/zakat/save`, {
      totalWealth: 350000,
      zakatAmount: 8750,
      gregorianDate: '2026-11-16',
      hijriDate: '24 Jumada al-ula 1448 AH',
      type: 'Current Zakat'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    assert(resSaveB_Current.status === 201, 'Expected status 201');
    recordIdB_Current = resSaveB_Current.data.data._id;

    const docB_Current = await ZakatRecord.findById(recordIdB_Current);
    assert(String(docB_Current.userId) === String(userIdB), 'userId mismatch');
    assert(docB_Current.username === nameUserB, `username mismatch: got ${docB_Current.username}`);
    assert(docB_Current.userEmail === emailUserB, `userEmail mismatch: got ${docB_Current.userEmail}`);
    assert(docB_Current.totalWealth === 350000);
    assert(docB_Current.zakatAmount === 8750);

    console.log('  Stored Record ID:', docB_Current._id);
    console.log('  userId:', docB_Current.userId);
    console.log('  username snapshot:', docB_Current.username);
    console.log('  userEmail snapshot:', docB_Current.userEmail);
    console.log('  ✅ TEST 2 PASSED: User B Current Zakat saved with accurate identity snapshot.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: User A saves Past Zakat → correct identity fields saved
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 3: User A Saves Past Zakat (Time Machine Snapshot) ---');
    const resSaveA_Past = await axios.post(`${baseURL}/api/zakat/save`, {
      totalWealth: 150000,
      zakatAmount: 3750,
      type: 'Missed Zakat'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(resSaveA_Past.status === 201, 'Expected status 201');
    recordIdA_Past = resSaveA_Past.data.data._id;

    const docA_Past = await PastZakatRecord.findById(recordIdA_Past);
    assert(docA_Past, 'Past record not found in DB');
    assert(String(docA_Past.userId) === String(userIdA), 'userId mismatch');
    assert(docA_Past.username === nameUserA, `username mismatch: got ${docA_Past.username}`);
    assert(docA_Past.userEmail === emailUserA, `userEmail mismatch: got ${docA_Past.userEmail}`);
    assert(docA_Past.type === 'Missed Zakat');

    console.log('  Stored Past Record ID:', docA_Past._id);
    console.log('  userId:', docA_Past.userId);
    console.log('  username snapshot:', docA_Past.username);
    console.log('  userEmail snapshot:', docA_Past.userEmail);
    console.log('  ✅ TEST 3 PASSED: User A Past Zakat saved with accurate identity snapshot.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: User B saves Past Zakat → correct identity fields saved
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 4: User B Saves Past Zakat (Time Machine Snapshot) ---');
    const resSaveB_Past = await axios.post(`${baseURL}/api/zakat/save`, {
      totalWealth: 500000,
      zakatAmount: 12500,
      type: 'Missed Zakat'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    assert(resSaveB_Past.status === 201, 'Expected status 201');
    recordIdB_Past = resSaveB_Past.data.data._id;

    const docB_Past = await PastZakatRecord.findById(recordIdB_Past);
    assert(docB_Past, 'Past record not found in DB');
    assert(String(docB_Past.userId) === String(userIdB), 'userId mismatch');
    assert(docB_Past.username === nameUserB, `username mismatch: got ${docB_Past.username}`);
    assert(docB_Past.userEmail === emailUserB, `userEmail mismatch: got ${docB_Past.userEmail}`);

    console.log('  Stored Past Record ID:', docB_Past._id);
    console.log('  userId:', docB_Past.userId);
    console.log('  username snapshot:', docB_Past.username);
    console.log('  userEmail snapshot:', docB_Past.userEmail);
    console.log('  ✅ TEST 4 PASSED: User B Past Zakat saved with accurate identity snapshot.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Guest Calculations Continue Working (No fabricated identity)
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 5: Guest Calculation Functionality (No Fabricated Data) ---');
    // Guest calls current calculation endpoint without auth token
    const resGuestCalc = await axios.post(`${baseURL}/api/zakat/current`, {
      isOneYearComplete: true,
      netCash: 100000,
      goldGm: 10,
      silverGm: 50
    });

    assert(resGuestCalc.status === 200, 'Guest calc failed');
    assert(resGuestCalc.data.success === true, 'Expected success: true');
    assert(resGuestCalc.data.isEligible === true, 'Expected isEligible: true');
    assert(resGuestCalc.data.zakatAmount > 0, 'Expected zakatAmount > 0');
    console.log('  Guest calculation executed successfully: Total Wealth =', resGuestCalc.data.totalWealth, '| Zakat =', resGuestCalc.data.zakatAmount);

    // If guest attempts to call /save without token, rejected with 401
    try {
      await axios.post(`${baseURL}/api/zakat/save`, {
        totalWealth: 100000,
        zakatAmount: 2500,
        type: 'Current Zakat'
      });
      throw new Error('Guest should not be able to save without token');
    } catch (guestErr) {
      assert(guestErr.response && guestErr.response.status === 401);
      console.log('  Unauthenticated save correctly rejected (401):', guestErr.response.data.message);
    }
    console.log('  ✅ TEST 5 PASSED: Guest calculations operational with zero fabricated identity data.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: User A cannot access or delete User B's records
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 6: Cross-User Data Isolation (A cannot read/delete B) ---');
    // User A fetches history
    const resHistoryA = await axios.get(`${baseURL}/api/zakat/history`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const historyIdsA = resHistoryA.data.data.map(r => String(r._id));
    assert(!historyIdsA.includes(String(recordIdB_Current)), 'Isolation breach: User A sees User B current record');
    assert(!historyIdsA.includes(String(recordIdB_Past)), 'Isolation breach: User A sees User B past record');
    console.log('  User A history check: Zero User B records returned (OK)');

    // User A attempts to delete User B's record
    try {
      await axios.delete(`${baseURL}/api/zakat/${recordIdB_Current}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      throw new Error('User A should not be able to delete User B record');
    } catch (delErr) {
      assert(delErr.response && delErr.response.status === 404);
      console.log('  Cross-user deletion attempt blocked (404 Not Found): OK');
    }

    // Verify User B's record is still intact
    const verifyDocBStillExists = await ZakatRecord.findById(recordIdB_Current);
    assert(verifyDocBStillExists, 'User B document was deleted or modified!');
    console.log('  User B document verified safe in DB: OK');
    console.log('  ✅ TEST 6 PASSED: Strict cross-user data isolation verified.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Existing Legacy Records without identity fields remain accessible
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 7: Legacy Record Backward Compatibility ---');
    // Simulate legacy document without username or userEmail
    const legacyDoc = new ZakatRecord({
      userId: userIdA,
      totalWealth: 99999,
      zakatAmount: 2499.97,
      type: 'Current Zakat'
      // username and userEmail intentionally omitted
    });
    await legacyDoc.save();
    legacyRecordId = legacyDoc._id;

    // Fetch history for User A
    const resHistoryWithLegacy = await axios.get(`${baseURL}/api/zakat/history`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const foundLegacy = resHistoryWithLegacy.data.data.find(r => String(r._id) === String(legacyRecordId));
    assert(foundLegacy, 'Legacy record not returned');
    assert(foundLegacy.totalWealth === 99999);
    assert(foundLegacy.username === undefined || foundLegacy.username === null);
    console.log('  Legacy record loaded cleanly without schema errors: OK');
    console.log('  ✅ TEST 7 PASSED: Existing records without identity snapshots work seamlessly.');
    passedTests++;

    // ─────────────────────────────────────────────────────────────────
    // TEST 8: Existing Zakat Calculations Return Exactly the Same Results
    // ─────────────────────────────────────────────────────────────────
    totalTests++;
    console.log('\n--- Test 8: Calculation Mathematical Fidelity ---');
    const resCalcMath = await axios.post(`${baseURL}/api/zakat/current`, {
      isOneYearComplete: true,
      netCash: 200000,
      goldGm: 0,
      silverGm: 0
    });
    assert(resCalcMath.status === 200);
    assert(resCalcMath.data.totalWealth === 200000);
    assert(resCalcMath.data.zakatAmount === 5000); // 200000 * 0.025 = 5000
    console.log('  2.5% calculation: 200,000 * 0.025 =', resCalcMath.data.zakatAmount, '(Exact match)');
    console.log('  ✅ TEST 8 PASSED: Mathematical calculations return 100% consistent results.');
    passedTests++;

  } finally {
    console.log('\n🧹 Cleaning up test artifacts...');
    await User.deleteMany({ email: { $in: [emailUserA, emailUserB] } });
    if (recordIdA_Current) await ZakatRecord.findByIdAndDelete(recordIdA_Current);
    if (recordIdB_Current) await ZakatRecord.findByIdAndDelete(recordIdB_Current);
    if (recordIdA_Past) await PastZakatRecord.findByIdAndDelete(recordIdA_Past);
    if (recordIdB_Past) await PastZakatRecord.findByIdAndDelete(recordIdB_Past);
    if (legacyRecordId) await ZakatRecord.findByIdAndDelete(legacyRecordId);
    console.log('✅ Cleanup complete.');

    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`🎉 SNAPSHOT TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSnapshotTests().catch(err => {
  console.error('Fatal snapshot test error:', err);
  process.exit(1);
});
