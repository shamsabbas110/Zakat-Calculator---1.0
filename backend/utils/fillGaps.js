const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const moment = require('moment-hijri');
const PastRate = require('../models/PastRate');

dotenv.config({ path: path.join(__dirname, '../.env') });

const hijriMonths = [
  "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
  "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

// Helper to get adjusted Hijri date (User requested -1 day adjustment)
function getAdjustedHijriDate(date) {
  // We use moment.subtract(1, 'days') to align with the user's local moon sighting/calendar
  const m = moment(date).subtract(1, 'days');
  const iDay = m.iDate();
  const iMonth = m.iMonth(); // 0-indexed
  const iYear = m.iYear();
  
  return `${iDay} ${hijriMonths[iMonth]} ${iYear} AH`;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB.');

    const startDate = new Date('2021-01-01');
    const endDate = new Date('2026-04-29');

    console.log('Fetching all existing rates...');
    const existingRates = await PastRate.find({}).sort({ date: 1 });
    
    // Create a map for quick lookup
    const ratesMap = {};
    existingRates.forEach(r => {
      const dStr = r.date.toISOString().split('T')[0];
      ratesMap[dStr] = r;
    });

    let lastKnownRate = { gold: 0, silver: 0 };
    const newRecords = [];
    const updates = [];

    console.log('Filling gaps for weekends and adjusting Hijri dates...');
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      const currentRecord = ratesMap[dStr];

      if (currentRecord) {
        // Update existing record's Hijri date
        const newHijri = getAdjustedHijriDate(d);
        if (currentRecord.hijriDate !== newHijri) {
          updates.push({
            updateOne: {
              filter: { _id: currentRecord._id },
              update: { hijriDate: newHijri }
            }
          });
        }
        // Update last known rate
        lastKnownRate = { 
          gold: currentRecord.goldRatePerGram, 
          silver: currentRecord.silverRatePerGram 
        };
      } else {
        // Missing date (likely Saturday/Sunday)
        newRecords.push({
          date: new Date(d),
          hijriDate: getAdjustedHijriDate(d),
          goldRatePerGram: lastKnownRate.gold,
          silverRatePerGram: lastKnownRate.silver
        });
      }
    }

    if (updates.length > 0) {
      console.log(`Updating ${updates.length} existing records with new Hijri adjustment...`);
      await PastRate.bulkWrite(updates);
    }

    if (newRecords.length > 0) {
      console.log(`Inserting ${newRecords.length} missing records (weekends/holidays)...`);
      await PastRate.insertMany(newRecords);
    }

    console.log('✅ All gaps filled and Hijri dates adjusted!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gap fill failed:', err);
    process.exit(1);
  }
}

run();
