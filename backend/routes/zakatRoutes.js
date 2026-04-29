const express = require('express');
const router = express.Router();
const multer = require('multer');
const momentHijri = require('moment-hijri');
const momentTz = require('moment-timezone');

// Import our controller functions
const { 
  calculateCurrentZakat: oldCalculateCurrentZakat, 
  calculateMissedZakat, 
  calculatePastZakatArray,
  uploadReceipt,
  saveZakatRecord,
  getZakatHistory,
  deleteZakatRecord,
  testDbConnection
} = require('../controllers/zakatController');

const {
  calculateCurrentZakat,
  calculatePastZakat,
  calculatePastZakatBulk,
  getPastDates,
  forceUpdateRates,
  updateRatesManual
} = require('../controllers/calculationController');

const upload = multer({ storage: multer.memoryStorage() });

// --- ROUTES ---

router.get('/test-db', testDbConnection);
router.post('/current', calculateCurrentZakat);

router.get('/rates', async (req, res) => {
    try {
        const PastRate = require('../models/PastRate');
        const latestRate = await PastRate.findOne().sort({ date: -1 });

        if (!latestRate) {
            return res.status(404).json({ success: false, message: "No rates found in database" });
        }
        
        // --- DYNAMIC TODAY (IST) ---
        const nowIST = momentTz().tz("Asia/Kolkata");
        
        // Use -1 adjustment to match user's local moon sighting (Today = 12)
        const hToday = momentHijri(nowIST.toDate()).subtract(1, 'days'); 
        const hijriMonths = ["Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
        const hijriDisplay = `${hToday.iDate()} ${hijriMonths[hToday.iMonth()]} ${hToday.iYear()} AH`;

        const NISAB_SILVER_WEIGHT = 612.36;
        const nisab = NISAB_SILVER_WEIGHT * latestRate.silverRatePerGram;
        
        res.status(200).json({
            success: true,
            goldRate: latestRate.goldRatePerGram,
            silverRate: latestRate.silverRatePerGram,
            nisab,
            date: todayObj.toISOString(),
            hijriDate: hijriDisplay
        });
    } catch (error) {
        console.error("❌ Error in /rates:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/past', calculatePastZakat);
router.post('/past-bulk', calculatePastZakatBulk);
router.post('/past-dates', getPastDates);
router.post('/admin/update-rates', forceUpdateRates);
router.post('/admin/update-rates-manual', updateRatesManual);
router.post('/missed', calculateMissedZakat);
router.post('/calculate-past', calculatePastZakatArray);
router.post('/upload-receipt', upload.single('receiptImage'), uploadReceipt);
router.post('/save', saveZakatRecord);
router.get('/history', getZakatHistory);
router.delete('/:id', deleteZakatRecord);

router.post('/update-manual-rates', async (req, res) => {
    const { password, goldRate, silverRate } = req.body;
    if (password !== 'admin110') return res.status(401).json({ success: false, message: "Unauthorized" });
    try {
        const PastRate = require('../models/PastRate');
        const nowIST = momentTz().tz("Asia/Kolkata");
        const m = momentHijri(nowIST.toDate()).subtract(1, 'days');
        const hijriMonths = ["Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
        const hDate = `${m.iDate()} ${hijriMonths[m.iMonth()]} ${m.iYear()} AH`;
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);
        const updatedRate = await PastRate.findOneAndUpdate(
            { date: targetDate },
            { day: dayName, hijriDate: hDate, goldRatePerGram: parseFloat(goldRate), silverRatePerGram: parseFloat(silverRate) },
            { upsert: true, new: true }
        );
        res.status(200).json({ success: true, message: "Rates updated!", data: updatedRate });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
