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

async function addRate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB.');

    const targetDate = new Date('2026-04-29');
    const silverRate = 222.18;
    const goldRate = 13921;
    
    // Check if record exists
    let record = await PastRate.findOne({ date: targetDate });

    const m = moment(targetDate);
    const hDate = `${m.iDate()} ${hijriMonths[m.iMonth()]} ${m.iYear()} AH`;

    if (record) {
      console.log('Record exists, updating rates...');
      record.goldRatePerGram = goldRate;
      record.silverRatePerGram = silverRate;
      record.hijriDate = hDate;
      await record.save();
    } else {
      console.log('Record not found, creating new record...');
      record = new PastRate({
        date: targetDate,
        hijriDate: hDate,
        goldRatePerGram: goldRate,
        silverRatePerGram: silverRate
      });
      await record.save();
    }

    console.log('✅ Rate for 29/04/2026 updated successfully!');
    console.log(JSON.stringify(record, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to add rate:', err);
    process.exit(1);
  }
}

addRate();
