const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const moment = require('moment-hijri');
const PastRate = require('../models/PastRate');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const records = await PastRate.find({});
    console.log(`Found ${records.length} records. Updating Hijri dates...`);

    const hijriMonths = [
      "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
      "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban",
      "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
    ];

    let count = 0;
    for (const record of records) {
      const m = moment(record.date);
      const iDay = m.iDate();
      const iMonth = m.iMonth(); // 0-indexed
      const iYear = m.iYear();
      
      const hDate = `${iDay} ${hijriMonths[iMonth]} ${iYear} AH`;
      
      record.hijriDate = hDate;
      await record.save();
      
      count++;
      if (count % 100 === 0) {
        console.log(`Updated ${count} records...`);
      }
    }

    console.log('✅ All Hijri dates updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Update failed:', err);
    process.exit(1);
  }
}

run();
