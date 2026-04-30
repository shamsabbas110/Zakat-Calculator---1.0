const mongoose = require('mongoose');
const PastRate = require('./models/PastRate');
require('dotenv').config();

async function checkLatest() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zakat-calculator');
    console.log('--- LATEST 5 RECORDS IN DATABASE ---');
    const records = await PastRate.find().sort({ date: -1 }).limit(5);
    
    records.forEach(r => {
      console.log(`Date: ${r.date.toISOString().split('T')[0]} | Hijri: ${r.hijriDate} | Gold: ${r.goldRatePerGram}`);
    });
    
    const count = await PastRate.countDocuments();
    console.log(`-----------------------------------`);
    console.log(`Total Rows in Collection: ${count}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkLatest();
