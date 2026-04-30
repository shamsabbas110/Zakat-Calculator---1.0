const PastRate = require('../models/PastRate');
const moment = require('moment-hijri');
require('moment-timezone'); // Extends the moment object above

// Force English locale to prevent Arabic numerals in dates
moment.locale('en');

/**
 * Standard Zakat Formula Constants
 */
const NISAB_SILVER_WEIGHT = 612.36; // grams
const ZAKAT_RATE = 0.025; // 2.5%

/**
 * Helper to get Hijri Parts
 */
const getHijriParts = (date) => {
    // Lock to IST and apply -1 day adjustment for local moon sighting
    const m = moment(date).tz('Asia/Kolkata').subtract(1, 'days');
    if (!m.isValid()) return { day: '01', monthNum: 0, monthName: 'Muharram', year: 1445 };
    const day = m.iDate();
    const monthIndex = m.iMonth();
    const year = m.iYear();
    const hijriMonths = ["Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
    return { day, monthNum: monthIndex, monthName: hijriMonths[monthIndex], year };
};

const calculateCurrentZakat = async (req, res) => {
    try {
        const { isOneYearComplete, netCash = 0, goldGm = 0, silverGm = 0 } = req.body;
        if (!isOneYearComplete) return res.status(200).json({ success: true, zakatAmount: 0, totalWealth: 0, nisab: 0, isEligible: false });

        const latestRate = await PastRate.findOne().sort({ date: -1 });
        if (!latestRate) return res.status(200).json({ success: false, message: "Market rates unavailable." });

        const goldRate = latestRate.goldRatePerGram;
        const silverRate = latestRate.silverRatePerGram;
        const nisab = NISAB_SILVER_WEIGHT * silverRate;
        const totalWealth = netCash + (goldGm * goldRate) + (silverGm * silverRate);
        let zakatAmount = 0;
        let isEligible = false;
        if (totalWealth >= nisab) { isEligible = true; zakatAmount = totalWealth * ZAKAT_RATE; }

        // Use Current IST Date for display (to ensure 12 AM flip works)
        const nowIST = moment().tz('Asia/Kolkata');
        const currentGregorian = nowIST.format('YYYY-MM-DD');
        const { day: cDay, monthName: cMonth, year: cYear } = getHijriParts(nowIST.toDate());
        const currentHijriDate = `${cDay} ${cMonth} ${cYear} AH`;

        // Next Due Date Calculation (Based on TODAY'S date - IST locked with -1 day adj)
        const nextDateMoment = moment().tz('Asia/Kolkata').subtract(1, 'days').add(1, 'iYear');
        const nextDueDateGregorian = nextDateMoment.format('YYYY-MM-DD');
        const { day: nDay, monthName: nMonth, year: nYear } = getHijriParts(nextDueDateGregorian);
        const nextDueDateHijri = `${nDay} ${nMonth} ${nYear} AH`;

        return res.status(200).json({ 
            success: true, 
            totalWealth, 
            nisab, 
            goldRate, 
            silverRate, 
            zakatAmount, 
            isEligible, 
            date: currentGregorian, 
            hijriDate: currentHijriDate, 
            nextDueDateGregorian, 
            nextDueDateHijri 
        });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const calculatePastZakat = async (req, res) => {
    try {
        const { englishDate, netCash, goldGm = 0, silverGm = 0, singleYear = false } = req.body;
        const startHijri = getHijriParts(englishDate);
        const anniversaryDay = startHijri.day;
        const anniversaryMonth = startHijri.monthName;
        let currentHijriYear = moment().iYear();
        let loopYear = startHijri.year + 1;
        let yearlyBreakdown = [];
        let totalPendingZakat = 0;
        let currentWealth = netCash; 

        while (loopYear <= currentHijriYear) {
            const searchString = new RegExp(`^${anniversaryDay} ${anniversaryMonth} ${loopYear}`, 'i');
            let pastRate = await PastRate.findOne({ hijriDate: searchString });
            if (!pastRate) {
                const monthSearch = new RegExp(`${anniversaryMonth} ${loopYear}`, 'i');
                pastRate = await PastRate.findOne({ hijriDate: monthSearch });
                if (!pastRate) { loopYear++; if (singleYear) break; continue; }
            }
            const goldRate = pastRate.goldRatePerGram;
            const silverRate = pastRate.silverRatePerGram;
            const nisab = NISAB_SILVER_WEIGHT * silverRate;
            const totalWealthAtPoint = currentWealth + (goldGm * goldRate) + (silverGm * silverRate);
            if (totalWealthAtPoint >= nisab) {
                const zakatForThisYear = totalWealthAtPoint * ZAKAT_RATE;
                currentWealth -= zakatForThisYear;
                totalPendingZakat += zakatForThisYear;
                yearlyBreakdown.push({ year: loopYear, hijriDate: pastRate.hijriDate, gregorianDate: pastRate.date, totalWealth: totalWealthAtPoint, nisab: nisab, zakatAmount: zakatForThisYear, status: "Eligible" });
            } else {
                yearlyBreakdown.push({ year: loopYear, hijriDate: pastRate.hijriDate, gregorianDate: pastRate.date, totalWealth: totalWealthAtPoint, nisab: nisab, zakatAmount: 0, status: "Below Nisab - Cycle Broken" });
                break; 
            }
            if (singleYear) break;
            loopYear++;
        }
        return res.status(200).json({ success: true, anniversary: `${anniversaryDay} ${anniversaryMonth}`, totalPendingZakat, yearlyBreakdown });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const calculatePastZakatBulk = async (req, res) => {
    try {
        const { startDate, yearsCount, wealthArray } = req.body;
        const startHijri = getHijriParts(startDate);
        const anniversaryDay = startHijri.day;
        const anniversaryMonth = startHijri.monthName;
        let yearlyBreakdown = [];
        let totalPendingZakat = 0;
        let cumulativeUnpaidZakat = 0;

        for (let i = 0; i < yearsCount; i++) {
            const loopYear = startHijri.year + i + 1; 
            console.log(`[Bulk] Processing Year: ${loopYear}, Month: ${anniversaryMonth}, Day: ${anniversaryDay}`);
            
            const gregMoment = moment().iYear(loopYear).iMonth(startHijri.monthNum).iDate(1);
            gregMoment.iDate(anniversaryDay).startOf('day');
            if (gregMoment.isAfter(moment())) {
                console.log(`[Bulk] Year ${loopYear} is in the future, skipping.`);
                break;
            }

            const userCash = parseFloat(wealthArray[i]?.cash) || 0;
            const userGoldGm = parseFloat(wealthArray[i]?.goldGm) || 0;
            const userSilverGm = parseFloat(wealthArray[i]?.silverGm) || 0;

            const searchString = new RegExp(`^${anniversaryDay} ${anniversaryMonth} ${loopYear}`, 'i');
            console.log(`[Bulk] Searching with regex: ${searchString}`);
            
            let selectedRate = await PastRate.findOne({ hijriDate: searchString });
            if (!selectedRate) {
                console.log(`[Bulk] Exact date match failed, trying month fallback...`);
                const monthSearch = new RegExp(`${anniversaryMonth} ${loopYear}`, 'i');
                selectedRate = await PastRate.findOne({ hijriDate: monthSearch });
            }

            if (!selectedRate) {
                console.warn(`[Bulk] NO RATE DATA FOUND for ${anniversaryMonth} ${loopYear}`);
                yearlyBreakdown.push({ year: loopYear, status: "Rate Data Missing", zakatAmount: 0 });
                continue;
            }
            
            console.log(`[Bulk] Found Rate: Gold=${selectedRate.goldRatePerGram}, Silver=${selectedRate.silverRatePerGram}`);

            const nisab = NISAB_SILVER_WEIGHT * selectedRate.silverRatePerGram;
            const userProvidedWealth = userCash + (userGoldGm * selectedRate.goldRatePerGram) + (userSilverGm * selectedRate.silverRatePerGram);
            const effectiveWealth = userProvidedWealth - cumulativeUnpaidZakat;
            
            if (effectiveWealth >= nisab) {
                const zakatForThisYear = effectiveWealth * ZAKAT_RATE;
                cumulativeUnpaidZakat += zakatForThisYear;
                totalPendingZakat += zakatForThisYear;
                yearlyBreakdown.push({ year: loopYear, hijriDate: selectedRate.hijriDate, gregorianDate: selectedRate.date, userWealth: userProvidedWealth, effectiveWealth, nisab, zakatAmount: zakatForThisYear, status: "Eligible" });
            } else {
                yearlyBreakdown.push({ year: loopYear, hijriDate: selectedRate.hijriDate, gregorianDate: selectedRate.date, userWealth: userProvidedWealth, effectiveWealth, nisab, zakatAmount: 0, status: "Below Nisab - Cycle Broken" });
                return res.status(200).json({ success: true, cycleBroken: true, totalPendingZakat, yearlyBreakdown });
            }
        }
        return res.status(200).json({ success: true, cycleBroken: false, totalPendingZakat, yearlyBreakdown });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getPastDates = async (req, res) => {
    try {
        const { startDate, yearsCount } = req.body;
        const startHijri = getHijriParts(startDate);
        const anniversaryDay = startHijri.day;
        const anniversaryMonth = startHijri.monthName;
        let dates = [];
        for (let i = 0; i < yearsCount; i++) {
            const loopYear = startHijri.year + i + 1;
            const gregMoment = moment().iYear(loopYear).iMonth(startHijri.monthNum).iDate(1);
            gregMoment.iDate(anniversaryDay).startOf('day');
            dates.push({ gregorian: gregMoment.format('DD-MM-YYYY'), hijri: `${anniversaryDay} ${anniversaryMonth} ${loopYear} AH`, isFuture: gregMoment.isAfter(moment()) });
        }
        res.status(200).json({ success: true, dates });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const forceUpdateRates = async (req, res) => {
    try {
        const { updateRates } = require('../utils/cronJob');
        const updatedData = await updateRates(true);
        if (updatedData) res.status(200).json({ success: true, message: "Sync complete.", data: updatedData });
        else res.status(500).json({ success: false, message: "Sync failed." });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const updateRatesManual = async (req, res) => {
    try {
        const { date, goldRatePerGram, silverRatePerGram } = req.body;
        // Use IST Today for manual update
        const nowIST = moment().tz("Asia/Kolkata").startOf('day');
        const targetDate = date ? new Date(date) : nowIST.toDate();
        targetDate.setUTCHours(0,0,0,0);
        
        const hijriMonths = ["Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
        const m = moment(targetDate).tz('Asia/Kolkata').subtract(1, 'days');
        const hDate = `${m.iDate()} ${hijriMonths[m.iMonth()]} ${m.iYear()} AH`;
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);
        
        await PastRate.findOneAndUpdate({ date: targetDate }, { day: dayName, hijriDate: hDate, goldRatePerGram, silverRatePerGram }, { upsert: true, new: true });
        res.status(200).json({ success: true, message: "Manual rates saved." });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { calculateCurrentZakat, calculatePastZakat, calculatePastZakatBulk, getPastDates, forceUpdateRates, updateRatesManual };
