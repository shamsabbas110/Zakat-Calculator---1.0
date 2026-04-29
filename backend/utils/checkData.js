const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const PastRate = require('../models/PastRate');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const record = await PastRate.findOne();
    console.log('Sample Record from DB:');
    console.log(JSON.stringify(record, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
