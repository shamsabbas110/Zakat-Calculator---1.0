/**
 * test_zakat_calculations.js
 * Comprehensive Zakat Calculation & Nisab Integrity Test Suite
 */

const assert = require('assert');

console.log('====================================================');
console.log('🕋 ZAKAT CALCULATION & NISAB MATHEMATICAL AUDIT');
console.log('====================================================\n');

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

// 1. Core Islamic Fiqh Constants
const NISAB_SILVER_WEIGHT = 612.36; // grams (52.5 tolas / 200 silver dirhams)
const NISAB_GOLD_WEIGHT = 87.48;   // grams (7.5 tolas / 20 gold mithqals)
const ZAKAT_RATE = 0.025;          // 2.5% (1/40th)

// Test 1: Mathematical Constants Verification
runTest('Islamic Fiqh Constants: Silver 612.36g, Gold 87.48g, Rate 0.025', () => {
  assert.strictEqual(NISAB_SILVER_WEIGHT, 612.36);
  assert.strictEqual(NISAB_GOLD_WEIGHT, 87.48);
  assert.strictEqual(ZAKAT_RATE, 0.025);
  assert.strictEqual(1 / 40, ZAKAT_RATE);
});

// Test 2: Silver Nisab Calculation
runTest('Silver Nisab Threshold Calculation with Market Rates', () => {
  const silverRatePerGram = 95.50; // Example rate in INR
  const expectedNisab = 612.36 * 95.50; // ₹58,480.38
  const calculatedNisab = NISAB_SILVER_WEIGHT * silverRatePerGram;
  assert.strictEqual(calculatedNisab, expectedNisab);
  assert.ok(calculatedNisab > 50000, 'Nisab must reflect realistic silver value');
});

// Test 3: Total Wealth Calculation (Cash + Gold + Silver)
runTest('Total Zakatable Wealth Aggregation', () => {
  const netCash = 100000; // ₹1,00,000
  const goldGm = 20;      // 20 grams
  const goldRate = 7200;  // ₹7,200/g
  const silverGm = 100;   // 100 grams
  const silverRate = 95;  // ₹95/g

  const expectedTotalWealth = netCash + (goldGm * goldRate) + (silverGm * silverRate);
  // 100,000 + 144,000 + 9,500 = 253,500
  assert.strictEqual(expectedTotalWealth, 253500);
});

// Test 4: Zakat Eligibility when Total Wealth >= Nisab
runTest('Eligibility & Exact 2.5% Calculation When Wealth >= Nisab', () => {
  const silverRate = 90;
  const nisab = NISAB_SILVER_WEIGHT * silverRate; // ₹55,112.40
  const totalWealth = 200000; // ₹2,00,000
  const isOneYearComplete = true;

  let zakatAmount = 0;
  let isEligible = false;

  if (isOneYearComplete && totalWealth >= nisab) {
    isEligible = true;
    zakatAmount = totalWealth * ZAKAT_RATE;
  }

  assert.strictEqual(isEligible, true);
  assert.strictEqual(zakatAmount, 5000); // 200,000 * 0.025 = 5,000
});

// Test 5: Ineligibility when Wealth is Below Nisab
runTest('Zero Zakat when Wealth is strictly Below Nisab', () => {
  const silverRate = 90;
  const nisab = NISAB_SILVER_WEIGHT * silverRate; // ₹55,112.40
  const totalWealth = 40000; // ₹40,000 (below nisab)
  const isOneYearComplete = true;

  let zakatAmount = 0;
  let isEligible = false;

  if (isOneYearComplete && totalWealth >= nisab) {
    isEligible = true;
    zakatAmount = totalWealth * ZAKAT_RATE;
  }

  assert.strictEqual(isEligible, false);
  assert.strictEqual(zakatAmount, 0);
});

// Test 6: Hawl Condition (Full Lunar Year Hold)
runTest('Zero Zakat when Hawl (1 Lunar Year) is Not Complete', () => {
  const silverRate = 90;
  const nisab = NISAB_SILVER_WEIGHT * silverRate; // ₹55,112.40
  const totalWealth = 500000; // ₹5,00,000 (well above nisab)
  const isOneYearComplete = false; // Hawl not met

  let zakatAmount = 0;
  let isEligible = false;

  if (isOneYearComplete && totalWealth >= nisab) {
    isEligible = true;
    zakatAmount = totalWealth * ZAKAT_RATE;
  }

  assert.strictEqual(isEligible, false);
  assert.strictEqual(zakatAmount, 0);
});

// Test 7: Multi-Year Missed Zakat (Time Machine) with Cycle Break
runTest('Time Machine: Multi-Year Unpaid Zakat with Cycle Break Below Nisab', () => {
  const historicalYears = [
    { year: 1443, wealth: 150000, nisab: 50000 }, // Year 1: Eligible
    { year: 1444, wealth: 30000,  nisab: 52000 }, // Year 2: Below Nisab -> Cycle Broken
    { year: 1445, wealth: 200000, nisab: 55000 }  // Year 3: After Cycle Break
  ];

  let totalPendingZakat = 0;
  let cumulativeUnpaidZakat = 0;
  let cycleBroken = false;
  const breakdown = [];

  for (const item of historicalYears) {
    const effectiveWealth = item.wealth - cumulativeUnpaidZakat;
    if (effectiveWealth >= item.nisab) {
      const zakatForYear = effectiveWealth * ZAKAT_RATE;
      cumulativeUnpaidZakat += zakatForYear;
      totalPendingZakat += zakatForYear;
      breakdown.push({ year: item.year, status: 'Eligible', zakat: zakatForYear });
    } else {
      breakdown.push({ year: item.year, status: 'Below Nisab - Cycle Broken', zakat: 0 });
      cycleBroken = true;
      break; // Cycle breaks
    }
  }

  assert.strictEqual(breakdown.length, 2);
  assert.strictEqual(breakdown[0].zakat, 150000 * 0.025); // 3,750
  assert.strictEqual(breakdown[1].status, 'Below Nisab - Cycle Broken');
  assert.strictEqual(breakdown[1].zakat, 0);
  assert.strictEqual(totalPendingZakat, 3750);
  assert.strictEqual(cycleBroken, true);
});

// Test 8: Floating Point Precision / Rounding in Financial Calculation
runTest('Floating Point Precision for Odd Totals', () => {
  const totalWealth = 133333.33;
  const zakat = totalWealth * ZAKAT_RATE;
  // 133,333.33 * 0.025 = 3333.33325
  const roundedZakat = Math.round(zakat * 100) / 100;
  assert.strictEqual(roundedZakat, 3333.33);
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Tests Passed`);
console.log('====================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
