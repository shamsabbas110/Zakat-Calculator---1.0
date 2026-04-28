const imagekit = require('../config/imagekit');
const { getCurrentHijriYear } = require('../utils/hijriCalendar');
const ZakatRecord = require('../models/ZakatRecord');
const PastZakatRecord = require('../models/PastZakatRecord');

// Note: Nisab is the minimum amount of wealth a Muslim must have before they are obligated to pay Zakat.
// In a real application, this value fluctuates with the current price of gold/silver.
// For simplicity, we are assuming a fixed Nisab value here, but it could also be passed from the frontend.
const DEFAULT_NISAB_THRESHOLD = 5000; 

/**
 * Controller to calculate Current Zakat and save it to the database
 */
const calculateCurrentZakat = async (req, res) => {
  try {
    // 1. Extract values sent from the user (frontend)
    const cash = req.body.cash || 0;
    const goldValue = req.body.goldValue || 0;
    const silverValue = req.body.silverValue || 0;
    const nisab = req.body.nisab || DEFAULT_NISAB_THRESHOLD;

    // Date context from frontend
    const { gregorianDate, hijriDate, nextDueDateGregorian, nextDueDateHijri } = req.body;

    // 2. Calculate the total wealth
    const totalWealth = cash + goldValue + silverValue;

    // 3. Check if total wealth meets the minimum threshold (Nisab)
    let zakatAmount = 0;
    let isEligible = false;

    if (totalWealth >= nisab) {
      isEligible = true;
      zakatAmount = totalWealth * 0.025;
    }

    // 4. Save the record to MongoDB if the date context is provided
    let savedRecord = null;
    if (gregorianDate) {
      const newRecord = new ZakatRecord({
        totalWealth,
        zakatAmount,
        gregorianDate,
        hijriDate,
        nextDueDateGregorian,
        nextDueDateHijri,
        status: isEligible ? "Calculated" : "Below Nisab"
      });
      savedRecord = await newRecord.save();
    }

    // 5. Send the result back to the user
    res.status(200).json({
      success: true,
      totalWealth: totalWealth,
      isEligible: isEligible,
      zakatAmount: zakatAmount,
      savedRecord: savedRecord,
      message: isEligible ? "You are eligible to pay Zakat. Record saved." : "Your wealth is below the Nisab threshold. No Zakat is due."
    });

  } catch (error) {
    // 🔴 DEEP ERROR LOGGING
    console.error("❌ MONGOOSE VALIDATION ERROR:");
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    if (error.errors) {
      console.error("Detailed Field Errors:", Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
    res.status(500).json({ success: false, message: error.message, details: error.errors });
  }
};

/**
 * Controller to calculate Missed (Past) Zakat
 */
const calculateMissedZakat = async (req, res) => {
  try {
    // 1. Extract data from request body
    // yearsMissed: how many years they missed (e.g., 5)
    // wealthHistory: an object mapping past years to wealth amounts (e.g., { "1": 10000, "2": 15000 })
    // where "1" means 1 year ago, "2" means 2 years ago, etc.
    const yearsMissed = req.body.yearsMissed || 0;
    const wealthHistory = req.body.wealthHistory || {};
    const nisab = req.body.nisab || DEFAULT_NISAB_THRESHOLD;

    // 2. Get the current Hijri year using our external API utility
    const currentHijriYear = await getCurrentHijriYear();

    let totalAccumulatedZakat = 0;
    const yearByYearBreakdown = [];
    
    // We use this variable to track if Zakat was paused because wealth dropped below Nisab
    let isZakatPaused = false;

    // 3. Traverse from the OLDEST year to the CURRENT year
    // Example: If yearsMissed is 5, we loop from i = 5 down to 1
    for (let i = yearsMissed; i >= 1; i--) {
      // Calculate the specific Hijri year for this iteration
      const pastHijriYear = currentHijriYear - i;
      
      // Get the user's wealth for this specific past year. Default to 0 if not provided.
      const wealthThatYear = wealthHistory[i.toString()] || 0;

      let zakatForThatYear = 0;

      // 4. Check conditions for Zakat
      // If wealth drops to 0 or below minimum threshold, Zakat obligation resets/pauses
      if (wealthThatYear < nisab) {
        isZakatPaused = true;
        zakatForThatYear = 0;
      } else {
        // If wealth sustains above Nisab, they must pay 2.5% for that year
        isZakatPaused = false;
        zakatForThatYear = wealthThatYear * 0.025;
      }

      // 5. Add to our total
      totalAccumulatedZakat += zakatForThatYear;

      // 6. Record the details for this year to show the user
      yearByYearBreakdown.push({
        yearsAgo: i,
        hijriYear: pastHijriYear,
        wealthAmount: wealthThatYear,
        wasBelowNisab: isZakatPaused,
        zakatOwed: zakatForThatYear
      });
    }

    // 7. Send the final breakdown to the user
    res.status(200).json({
      success: true,
      totalAccumulatedZakat: totalAccumulatedZakat,
      breakdown: yearByYearBreakdown
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller to upload a receipt image using ImageKit
 */
const uploadReceipt = async (req, res) => {
  try {
    // Multer will place the uploaded file in req.file
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided." });
    }

    // Upload the file buffer to ImageKit
    const response = await imagekit.upload({
      file: req.file.buffer, // The file data
      fileName: req.file.originalname, // The original file name
      folder: "/zakat_receipts" // A folder inside your ImageKit account
    });

    // Send back the secure URL provided by ImageKit
    res.status(200).json({
      success: true,
      message: "Receipt uploaded successfully",
      imageUrl: response.url
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Save a new Zakat calculation record to the database
 * Expected Body: { totalWealth, zakatAmount, gregorianDate, hijriDate, nextDueDateGregorian, nextDueDateHijri }
 */
const saveZakatRecord = async (req, res) => {
  try {
    const { 
      totalWealth, 
      zakatAmount, 
      gregorianDate, 
      hijriDate, 
      nextDueDateGregorian, 
      nextDueDateHijri 
    } = req.body;

    const newRecord = new ZakatRecord({
      totalWealth,
      zakatAmount,
      gregorianDate,
      hijriDate,
      nextDueDateGregorian,
      nextDueDateHijri
    });

    const savedRecord = await newRecord.save();

    res.status(201).json({
      success: true,
      message: "Zakat calculation saved permanently.",
      data: savedRecord
    });
  } catch (error) {
    // 🔴 DEEP ERROR LOGGING
    console.error("❌ MONGOOSE VALIDATION ERROR:");
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    if (error.errors) {
      console.error("Detailed Field Errors:", Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
    res.status(500).json({ success: false, message: error.message, details: error.errors });
  }
};

/**
 * Fetch all Zakat calculation history from the database
 */
const getZakatHistory = async (req, res) => {
  try {
    const currentHistory = await ZakatRecord.find().lean();
    const pastHistory = await PastZakatRecord.find().lean();
    
    // Combine both arrays and sort by createdAt descending
    const combinedHistory = [...currentHistory, ...pastHistory].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.status(200).json({
      success: true,
      data: combinedHistory
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a Zakat calculation record from the database by ID
 */
const deleteZakatRecord = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to delete from ZakatRecord first
    let deletedRecord = await ZakatRecord.findByIdAndDelete(id);
    
    // If not found, try to delete from PastZakatRecord
    if (!deletedRecord) {
      deletedRecord = await PastZakatRecord.findByIdAndDelete(id);
    }

    if (!deletedRecord) {
      return res.status(404).json({ success: false, message: "Record not found in any collection." });
    }

    res.status(200).json({
      success: true,
      message: "Record successfully deleted.",
      deletedId: id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Controller to calculate Past Zakat from an array of historical data
 * Sent by the React frontend wizard.
 */
const calculatePastZakatArray = async (req, res) => {
  try {
    console.log("INCOMING REQUEST TO calculatePastZakatArray:", req.body);
    // 1. Extract the array of historical data from the request body (sent as { years: [...] })
    const historicalData = req.body.years || req.body.historicalData;
    
    if (!historicalData || !Array.isArray(historicalData)) {
      console.log("Validation failed. historicalData is:", historicalData);
      return res.status(400).json({ 
        success: false, 
        message: "Invalid data format. Expected an array of historical data.",
        receivedBody: req.body,
        historicalDataExtracted: historicalData
      });
    }

    let grandTotalZakat = 0;
    let grandTotalWealth = 0;
    const timelineResults = [];

    // 2. Iteration: Loop through the unified timeline array of years
    for (let i = 0; i < historicalData.length; i++) {
      const yearData = historicalData[i];
      const { yearLabel, hijriYear, gregorianApprox, gregorianDate, totalWealth, droppedBelowNisab } = yearData;
      
      let zakatAmount = 0;
      let status = "";

      // 3. The Zero/Nisab Rule
      // If droppedBelowNisab is true, the Zakat obligation breaks for this year.
      if (droppedBelowNisab === true) {
        zakatAmount = 0;
        status = "Skipped - Balance dropped below Nisab";
      } else {
        // 4. The Normal Rule
        // If droppedBelowNisab is false, Zakat is Wajib. Calculate strictly 2.5% of total wealth.
        zakatAmount = (totalWealth || 0) * 0.025;
        status = "Calculated";
      }

      // Add to grand totals
      grandTotalZakat += zakatAmount;
      grandTotalWealth += (totalWealth || 0);

      // Add to the breakdown response
      timelineResults.push({
        yearLabel,
        hijriYear: String(hijriYear),
        gregorianDate: gregorianDate || gregorianApprox || 'Unknown',
        totalWealth: totalWealth || 0,
        droppedBelowNisab: droppedBelowNisab || false,
        zakatAmount,
        status
      });
    }

    // 5. Save a SINGLE summary record to the pastzakatrecords collection!
    const summaryRecord = new PastZakatRecord({
      type: 'Missed Zakat',
      totalWealth: grandTotalWealth,
      zakatAmount: grandTotalZakat,
      // We do not set specific dates here because this record represents multiple past years
    });
    
    await summaryRecord.save();

    // 6. Response Object
    res.status(200).json({
      success: true,
      grandTotalZakat: grandTotalZakat,
      timelineResults: timelineResults,
      savedRecord: summaryRecord
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Standalone Test Route to verify MongoDB connection and Schema
 * Route: GET /api/zakat/test-db
 */
const testDbConnection = async (req, res) => {
  try {
    const dummyRecord = new ZakatRecord({
      totalWealth: 10000,
      zakatAmount: 250,
      gregorianDate: "2024-03-15",
      hijriDate: "1445-09-05",
      nextDueDateGregorian: "2025-03-04",
      nextDueDateHijri: "1446-09-05"
    });

    const saved = await dummyRecord.save();
    console.log("✅ TEST DB SAVE SUCCESSFUL:", saved);
    res.status(200).json({ success: true, message: "Database is working perfectly!", data: saved });
  } catch (error) {
    console.error("❌ TEST DB SAVE FAILED:", error.message);
    if (error.errors) console.error("Validation Details:", error.errors);
    res.status(500).json({ success: false, message: "Database test failed.", error: error.message });
  }
};

module.exports = {
  calculateCurrentZakat,
  calculateMissedZakat,
  calculatePastZakatArray,
  uploadReceipt,
  saveZakatRecord,
  getZakatHistory,
  deleteZakatRecord,
  testDbConnection
};
