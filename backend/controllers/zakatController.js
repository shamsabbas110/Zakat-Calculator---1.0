const mongoose = require('mongoose');
const { getCurrentHijriYear } = require('../utils/hijriCalendar');
const ZakatRecord = require('../models/ZakatRecord');
const PastZakatRecord = require('../models/PastZakatRecord');
const User = require('../models/User');
const imagekit = require('../config/imagekit');

// Note: Nisab is the minimum amount of wealth a Muslim must have before they are obligated to pay Zakat.
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
      const recordData = {
        totalWealth,
        zakatAmount,
        gregorianDate,
        hijriDate,
        nextDueDateGregorian,
        nextDueDateHijri,
        status: isEligible ? "Calculated" : "Below Nisab"
      };

      // If user is authenticated, attach their verified userId, username, and userEmail
      if (req.userId) {
        recordData.userId = req.userId;
        let username = req.user?.name;
        let userEmail = req.user?.email;
        if (!username || !userEmail) {
          const u = await User.findById(req.userId);
          if (u) {
            username = username || u.name;
            userEmail = userEmail || u.email;
          }
        }
        if (username) recordData.username = username;
        if (userEmail) recordData.userEmail = userEmail;
      }

      const newRecord = new ZakatRecord(recordData);
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
    console.error("❌ MONGOOSE VALIDATION ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message, details: error.errors });
  }
};

/**
 * Controller to calculate Missed (Past) Zakat
 */
const calculateMissedZakat = async (req, res) => {
  try {
    const yearsMissed = req.body.yearsMissed || 0;
    const wealthHistory = req.body.wealthHistory || {};
    const nisab = req.body.nisab || DEFAULT_NISAB_THRESHOLD;

    const currentHijriYear = await getCurrentHijriYear();

    let totalAccumulatedZakat = 0;
    const yearByYearBreakdown = [];
    let isZakatPaused = false;

    for (let i = yearsMissed; i >= 1; i--) {
      const pastHijriYear = currentHijriYear - i;
      const wealthThatYear = wealthHistory[i.toString()] || 0;
      let zakatForThatYear = 0;

      if (wealthThatYear < nisab) {
        isZakatPaused = true;
        zakatForThatYear = 0;
      } else {
        isZakatPaused = false;
        zakatForThatYear = wealthThatYear * 0.025;
      }

      totalAccumulatedZakat += zakatForThatYear;

      yearByYearBreakdown.push({
        yearsAgo: i,
        hijriYear: pastHijriYear,
        wealthAmount: wealthThatYear,
        wasBelowNisab: isZakatPaused,
        zakatOwed: zakatForThatYear
      });
    }

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
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided." });
    }

    const response = await imagekit.upload({
      file: req.file.buffer,
      fileName: req.file.originalname,
      folder: "/zakat_receipts"
    });

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
 * STRICTLY SCOPED to the authenticated req.userId.
 */
const saveZakatRecord = async (req, res) => {
  try {
    // Enforce authentication
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to save records."
      });
    }

    const { 
      totalWealth, 
      zakatAmount, 
      gregorianDate, 
      hijriDate, 
      nextDueDateGregorian, 
      nextDueDateHijri,
      type
    } = req.body;

    const numWealth = Number(totalWealth);
    const numZakat = Number(zakatAmount);

    if (isNaN(numWealth) || numWealth < 0 || isNaN(numZakat) || numZakat < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid calculation values: totalWealth and zakatAmount must be non-negative numbers."
      });
    }

    // Obtain verified user identity snapshot strictly from server authentication state
    let username = req.user?.name;
    let userEmail = req.user?.email;
    if (!username || !userEmail) {
      const u = await User.findById(req.userId);
      if (u) {
        username = username || u.name;
        userEmail = userEmail || u.email;
      }
    }

    let savedRecord;
    
    if (type && type.toLowerCase().includes('missed')) {
      // Save to PastZakatRecord collection scoped to req.userId
      const pastRecord = new PastZakatRecord({
        userId: req.userId,
        username: username || undefined,
        userEmail: userEmail || undefined,
        totalWealth: numWealth,
        zakatAmount: numZakat,
        type: type || 'Missed Zakat'
      });
      savedRecord = await pastRecord.save();
    } else {
      // Save to ZakatRecord collection (Current) scoped to req.userId
      const newRecord = new ZakatRecord({
        userId: req.userId,
        username: username || undefined,
        userEmail: userEmail || undefined,
        totalWealth: numWealth,
        zakatAmount: numZakat,
        gregorianDate,
        hijriDate,
        nextDueDateGregorian,
        nextDueDateHijri,
        type: type || 'Current Zakat'
      });
      savedRecord = await newRecord.save();
    }

    res.status(201).json({
      success: true,
      message: "Zakat calculation saved permanently to your account.",
      data: savedRecord
    });
  } catch (error) {
    console.error("❌ MONGOOSE VALIDATION ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message, details: error.errors });
  }
};

/**
 * Fetch Zakat calculation history from the database
 * STRICTLY SCOPED to the authenticated req.userId.
 * Never returns records belonging to other users.
 */
const getZakatHistory = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to view calculation history."
      });
    }

    // Scoped strictly to authenticated user's ID
    const currentHistory = await ZakatRecord.find({ userId: req.userId }).lean();
    const pastHistory = await PastZakatRecord.find({ userId: req.userId }).lean();
    
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
 * STRICTLY SCOPED to the authenticated req.userId.
 * Users cannot delete another user's records.
 */
const deleteZakatRecord = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to delete records."
      });
    }

    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID format."
      });
    }
    
    // Find and delete only if the record belongs to the authenticated user
    let deletedRecord = await ZakatRecord.findOneAndDelete({ _id: id, userId: req.userId });
    
    if (!deletedRecord) {
      deletedRecord = await PastZakatRecord.findOneAndDelete({ _id: id, userId: req.userId });
    }

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Record not found or you do not have permission to delete it."
      });
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
 */
const calculatePastZakatArray = async (req, res) => {
  try {
    const historicalData = req.body.years || req.body.historicalData;
    
    if (!historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid data format. Expected an array of historical data."
      });
    }

    let grandTotalZakat = 0;
    let grandTotalWealth = 0;
    const timelineResults = [];

    for (let i = 0; i < historicalData.length; i++) {
      const yearData = historicalData[i];
      const { yearLabel, hijriYear, gregorianApprox, gregorianDate, totalWealth, droppedBelowNisab } = yearData;
      
      let zakatAmount = 0;
      let status = "";

      if (droppedBelowNisab === true) {
        zakatAmount = 0;
        status = "Skipped - Balance dropped below Nisab";
      } else {
        zakatAmount = (totalWealth || 0) * 0.025;
        status = "Calculated";
      }

      grandTotalZakat += zakatAmount;
      grandTotalWealth += (totalWealth || 0);

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

    // Save summary record scoped to req.userId if user is logged in
    let summaryRecord = null;
    if (req.userId) {
      let username = req.user?.name;
      let userEmail = req.user?.email;
      if (!username || !userEmail) {
        const u = await User.findById(req.userId);
        if (u) {
          username = username || u.name;
          userEmail = userEmail || u.email;
        }
      }

      summaryRecord = new PastZakatRecord({
        userId: req.userId,
        username: username || undefined,
        userEmail: userEmail || undefined,
        type: 'Missed Zakat',
        totalWealth: grandTotalWealth,
        zakatAmount: grandTotalZakat
      });
      await summaryRecord.save();
    }

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
 */
const testDbConnection = async (req, res) => {
  try {
    const count = await ZakatRecord.countDocuments();
    res.status(200).json({
      success: true,
      message: "Database connection verified.",
      recordCount: count
    });
  } catch (error) {
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
