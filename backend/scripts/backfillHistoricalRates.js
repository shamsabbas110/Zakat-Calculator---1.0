require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const moment = require('moment-hijri');
require('moment-timezone');

const connectDB = require('../config/db');
const PastRate = require('../models/PastRate');

moment.locale('en');

const hijriMonths = [
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-ula',
  'Jumada al-akhira',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

function getAdjustedHijriDate(date) {
  const m = moment(date).tz('Asia/Kolkata').subtract(1, 'days');

  return `${m.iDate()} ${hijriMonths[m.iMonth()]} ${m.iYear()} AH`;
}

function parseRates(html) {
  const regex = /\[D\((\d{4}),(\d{1,2}),(\d{1,2})\),R\((\d+),(\d+)\)\]/g;

  const rates = new Map();
  let match;

  while ((match = regex.exec(html)) !== null) {
    const [, year, month, day, value, precision] = match;

    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    rates.set(dateKey, {
      date: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
      rate: Number(value) / Math.pow(10, Number(precision)),
    });
  }

  return rates;
}

async function fetchYearRates(metal, year, headers) {
  const url = `https://www.rupeerates.in/${metal}/${year}`;

  const response = await axios.get(url, { headers });

  return parseRates(response.data);
}

async function backfillHistoricalRates() {
  const headers = {
    'User-Agent': 'Mozilla/5.0',
  };

  await connectDB();

  try {
    for (let year = 2021; year <= 2026; year++) {
      console.log(`\nFetching historical rates for ${year}...`);

      try {
        const goldRates = await fetchYearRates('gold', year, headers);
        const silverRates = await fetchYearRates('silver', year, headers);

        let saved = 0;

        for (const [dateKey, gold] of goldRates) {
          const silver = silverRates.get(dateKey);

          if (!silver) continue;

          const dayName = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            timeZone: 'UTC',
          }).format(gold.date);

          await PastRate.findOneAndUpdate(
            { date: gold.date },
            {
              $set: {
                day: dayName,
                hijriDate: getAdjustedHijriDate(gold.date),
                goldRatePerGram: gold.rate,
                silverRatePerGram: silver.rate,
                isCarriedForward: false,
              },
            },
            { upsert: true, new: true }
          );

          saved++;
        }

        console.log(`${year}: ${saved} date records saved/updated.`);
      } catch (error) {
        console.log(`${year}: Could not fetch data - ${error.message}`);
      }
    }

    console.log('\nHistorical backfill completed.');
  } catch (error) {
    console.error('Backfill failed:', error.message);
  } finally {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

backfillHistoricalRates();
