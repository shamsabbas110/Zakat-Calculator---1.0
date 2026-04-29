const axios = require('axios');
const moment = require('moment-hijri');

const hijriMonths = [
  "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani",
  "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

function getAdjustedHijriDate(date) {
  const m = moment(date).subtract(1, 'days');
  const iDay = m.iDate();
  const iMonth = m.iMonth(); 
  const iYear = m.iYear();
  return `${iDay} ${hijriMonths[iMonth]} ${iYear} AH`;
}

// Emulate website helper functions
function D(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function R(v, p) { return v / Math.pow(10, p); }

async function scrapeRates() {
  try {
    console.log('Scraping latest rates from script tags...');
    
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

    // Scrape Gold
    const goldRes = await axios.get('https://www.rupeerates.in/gold/2026', { headers });
    const goldMatches = goldRes.data.match(/chart_MetalChart\.addChartGroup\(.*?,\[(.*?)\]\);/);
    if (!goldMatches) throw new Error('Could not find Gold data array');
    
    // The data array is a string like "[D(2026,1,1),R(1251325,2)],[D(2026,1,2),R(1274945,2)],..."
    // We can evaluate it safely by replacing D and R with our functions or regex parsing.
    const goldDataStr = goldMatches[1];
    const goldItems = goldDataStr.split('],[').map(s => s.replace(/[\[\]]/g, ''));
    const lastGoldItem = goldItems[goldItems.length - 1];
    
    // Parse last item: "D(2026,4,29),R(1392100,2)"
    const goldParts = lastGoldItem.match(/D\((\d+),(\d+),(\d+)\),R\((\d+),(\d+)\)/);
    const goldDate = D(goldParts[1], goldParts[2], goldParts[3]);
    const goldPrice = R(goldParts[4], goldParts[5]);

    // Scrape Silver
    const silverRes = await axios.get('https://www.rupeerates.in/silver/2026', { headers });
    const silverMatches = silverRes.data.match(/chart_MetalChart\.addChartGroup\(.*?,\[(.*?)\]\);/);
    if (!silverMatches) throw new Error('Could not find Silver data array');
    
    const silverDataStr = silverMatches[1];
    const silverItems = silverDataStr.split('],[').map(s => s.replace(/[\[\]]/g, ''));
    const lastSilverItem = silverItems[silverItems.length - 1];
    
    const silverParts = lastSilverItem.match(/D\((\d+),(\d+),(\d+)\),R\((\d+),(\d+)\)/);
    const silverDate = D(silverParts[1], silverParts[2], silverParts[3]);
    const silverPrice = R(silverParts[4], silverParts[5]);

    console.log('Results:');
    console.log(`Gold: ${goldDate.toISOString()} -> ${goldPrice}`);
    console.log(`Silver: ${silverDate.toISOString()} -> ${silverPrice}`);
    console.log(`Hijri: ${getAdjustedHijriDate(goldDate)}`);

  } catch (err) {
    console.error('Scrape failed:', err.message);
  }
}

scrapeRates();
