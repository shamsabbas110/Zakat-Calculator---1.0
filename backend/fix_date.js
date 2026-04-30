const mongoose = require('mongoose');
const moment = require('moment-hijri');
const PastRate = require('./models/PastRate');
require('dotenv').config();

const hijriMonths = [
  "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
  "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

async function fixTodayDate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zakat-calculator');
    console.log('Connected to DB');

    const today = new Date();
    today.setHours(0,0,0,0);
    // Force set to May 1st for the script
    const targetDate = new Date("2026-05-01T00:00:00.000Z");
    
    const m = moment(targetDate).add(1, 'days');
    const hDate = `${m.iDate()} ${hijriMonths[m.iMonth()]} ${m.iYear()} AH`;
    
    const result = await PastRate.findOneAndUpdate(
      { date: targetDate },
      { hijriDate: hDate },
      { new: true }
    );

    if (result) {
      console.log(`Successfully updated ${targetDate.toISOString().split('T')[0]} to ${hDate}`);
    } else {
      console.log('No record found for today. Creating one with dummy rates...');
      await PastRate.create({
        date: targetDate,
        day: "Friday",
        hijriDate: hDate,
        goldRatePerGram: 7000, // Dummy
        silverRatePerGram: 90
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixTodayDate();
