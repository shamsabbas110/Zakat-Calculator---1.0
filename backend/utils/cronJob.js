const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment-hijri');
const mongoose = require('mongoose');
const PastRate = require('../models/PastRate');

const hijriMonths = [
  "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
  "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

function getAdjustedHijriDate(date) {
  const m = moment(date);
  const iDay = m.iDate();
  const iMonth = m.iMonth(); 
  const iYear = m.iYear();
  return `${iDay} ${hijriMonths[iMonth]} ${iYear} AH`;
}

// Website helper emulators
function D(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function R(v, p) { return v / Math.pow(10, p); }

async function updateRates(forceSync = false) {
  try {
    console.log(`[Cron] Updating rates at ${new Date().toISOString()}`);
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
    const currentYear = new Date().getFullYear();

    // 1. Scrape Gold
    const goldRes = await axios.get(`https://www.rupeerates.in/gold/${currentYear}`, { headers });
    const goldMatches = goldRes.data.match(/chart_MetalChart\.addChartGroup\(.*?,\[(.*?)\]\);/);
    
    // 2. Scrape Silver
    const silverRes = await axios.get(`https://www.rupeerates.in/silver/${currentYear}`, { headers });
    const silverMatches = silverRes.data.match(/chart_MetalChart\.addChartGroup\(.*?,\[(.*?)\]\);/);

    if (!goldMatches || !silverMatches) {
      console.error('[Cron] Could not find data arrays on website');
      return;
    }

    const goldItems = goldMatches[1].split('],[');
    const lastGoldItem = goldItems[goldItems.length - 1];
    const goldParts = lastGoldItem.match(/D\((\d+),(\d+),(\d+)\),R\((\d+),(\d+)\)/);
    const latestDate = D(goldParts[1], goldParts[2], goldParts[3]);
    const goldPrice = R(goldParts[4], goldParts[5]);

    const silverItems = silverMatches[1].split('],[');
    const lastSilverItem = silverItems[silverItems.length - 1];
    const silverParts = lastSilverItem.match(/D\((\d+),(\d+),(\d+)\),R\((\d+),(\d+)\)/);
    const silverPrice = R(silverParts[4], silverParts[5]);

    // 3. Save to DB (Only if it's a real new date from website)
    const hDate = getAdjustedHijriDate(latestDate);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(latestDate);
    
    await PastRate.findOneAndUpdate(
      { date: latestDate },
      { 
        day: dayName,
        hijriDate: hDate,
        goldRatePerGram: goldPrice,
        silverRatePerGram: silverPrice
      },
      { upsert: true, new: true }
    );

    console.log(`[Cron] Successfully updated rates for ${latestDate.toISOString().split('T')[0]} (${dayName})`);

    // --- AUTOMATIC GAP FILLING LOGIC (Ensures Saturday/Sunday get Friday's rates) ---
    let finalResult = { date: latestDate, goldPrice, silverPrice, hDate };

    // We always want to fill gaps up to Today (IST)
    const todayStr = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
    const today = new Date(todayStr);
    today.setHours(0,0,0,0);
    
    if (today > latestDate) {
        console.log(`[Cron] Gap detected between ${latestDate.toISOString().split('T')[0]} and today. Filling gaps...`);
        let tempDate = new Date(latestDate);
        tempDate.setDate(tempDate.getDate() + 1);
        while (tempDate <= today) {
            const d = new Date(tempDate);
            await PastRate.findOneAndUpdate(
                { date: d },
                { 
                    day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d),
                    hijriDate: getAdjustedHijriDate(d),
                    goldRatePerGram: goldPrice,
                    silverRatePerGram: silverPrice
                },
                { upsert: true }
            );
            tempDate.setDate(tempDate.getDate() + 1);
        }
        console.log(`[Cron] Automatic Sync successful up to ${todayStr}`);
        finalResult = { date: today, goldPrice, silverPrice, hDate: getAdjustedHijriDate(today) };
    }

    return finalResult;

  } catch (err) {
    console.error('[Cron] Error in rate update task:', err.message);
    return null;
  }
}

// Initialize Cron Job (Runs at 12:05 AM and 12:05 PM IST every day)
const initCron = () => {
  // 5 0,12 * * * = Runs twice a day
  cron.schedule('5 0,12 * * *', () => {
    updateRates(false); // Automated scraper (Real data only)
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  console.log('✅ Gold/Silver Rate Cron Job Initialized (IST Timezone)');
  
  // Also run once on startup (Real data only)
  updateRates(false);
};

module.exports = { initCron, updateRates };
