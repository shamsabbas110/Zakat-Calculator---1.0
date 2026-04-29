const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const PastRate = require('../models/PastRate');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const records = await PastRate.find({});
    console.log(`Found ${records.length} records. Filling 'day' field...`);

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const record of records) {
      const dayName = days[new Date(record.date).getUTCDay()];
      record.day = dayName;
      await record.save();
    }

    console.log('✅ Day names filled successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
