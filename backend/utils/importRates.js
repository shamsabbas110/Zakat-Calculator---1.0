const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PastRate = require('../models/PastRate');

dotenv.config({ path: path.join(__dirname, '../.env') });

const GOLD_FILES = [
  '2021 gold rate.csv',
  '2022 gold rate.csv',
  'gold rate 2023.csv',
  'gold rate 2024.csv',
  'gold rate 2025.csv',
  'gold rate 2026.csv'
];

const SILVER_FILES = [
  'silver rate 2021.csv',
  'silver rate 2022.csv',
  'silver rate 2023.csv',
  'silver rate 2024.csv',
  'silver rate 2025.csv',
  'silver rate 2026.csv'
];

const DOWNLOADS_DIR = 'C:/Users/HP/Downloads';

const allData = {}; // Key: DD-MM-YYYY

function parseDate(dateStr) {
  // Handles DD-MM-YYYY
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
}

function getHijriDate(date) {
  return new Intl.DateTimeFormat('en-u-ca-islamic-uma-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

async function processFile(fileName, type) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return resolve();
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Headers might be 'date' or 'Column1'
        const dateKey = row.date || row.Column1;
        const rateKey = row['gold rate /gm'] || row['silver rate /gm'] || row.Column3;

        if (dateKey && rateKey) {
          const dateStr = dateKey.trim();
          const rateVal = parseFloat(rateKey.replace(/,/g, ''));

          if (!allData[dateStr]) {
            allData[dateStr] = { date: dateStr, gold: 0, silver: 0 };
          }

          if (type === 'gold') {
            allData[dateStr].gold = rateVal;
          } else {
            allData[dateStr].silver = rateVal;
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    console.log('Connected.');

    console.log('Parsing Gold files...');
    for (const file of GOLD_FILES) {
      await processFile(file, 'gold');
    }

    console.log('Parsing Silver files...');
    for (const file of SILVER_FILES) {
      await processFile(file, 'silver');
    }

    const records = [];
    console.log('Preparing records for migration...');
    
    for (const key in allData) {
      const entry = allData[key];
      const dateObj = parseDate(entry.date);
      if (!dateObj || isNaN(dateObj.getTime())) continue;

      records.push({
        date: dateObj,
        hijriDate: getHijriDate(dateObj),
        goldRatePerGram: entry.gold,
        silverRatePerGram: entry.silver
      });
    }

    console.log(`Clearing existing records in 'past_5_year_rates_2021_to_2026'...`);
    await PastRate.deleteMany({});

    console.log(`Migrating ${records.length} records...`);
    // Using bulkWrite or insertMany. insertMany is fine for ~2000 records.
    await PastRate.insertMany(records);

    console.log('✅ Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
