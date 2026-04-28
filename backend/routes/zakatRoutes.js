const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import our controller functions
const { 
  calculateCurrentZakat, 
  calculateMissedZakat, 
  calculatePastZakatArray,
  uploadReceipt,
  saveZakatRecord,
  getZakatHistory,
  deleteZakatRecord,
  testDbConnection
} = require('../controllers/zakatController');

// Configure Multer to store uploaded files in memory
// This is required before sending the file to ImageKit
const upload = multer({ storage: multer.memoryStorage() });

// --- ROUTES ---

// Route 0: Test DB Connection
// Method: GET
router.get('/test-db', testDbConnection);

// Route 1: Calculate Current Zakat
// Method: POST
// Expected Body: { "cash": 5000, "goldValue": 2000, "silverValue": 0 }
router.post('/current', calculateCurrentZakat);

// Route 2: Calculate Missed Zakat (Old structure)
// Method: POST
// Expected Body: { "yearsMissed": 3, "wealthHistory": { "1": 10000, "2": 8000, "3": 12000 } }
router.post('/missed', calculateMissedZakat);

// Route: Calculate Past Zakat from Array (Frontend Wizard)
// Method: POST
// Expected Body: { "historicalData": [{ "hijriYear": "1443", "gregorianDate": "2021", "totalWealth": 50000, "droppedBelowNisab": false }] }
router.post('/calculate-past', calculatePastZakatArray);

// Route 3: Upload a receipt
// Method: POST
// Expected Form-Data: key="receiptImage", value=[File]
router.post('/upload-receipt', upload.single('receiptImage'), uploadReceipt);

// Route 4: Save a calculation to DB
// Method: POST
router.post('/save', saveZakatRecord);

// Route 5: Get all history from DB
// Method: GET
router.get('/history', getZakatHistory);

// Route 6: Delete a specific record from DB
// Method: DELETE
router.delete('/:id', deleteZakatRecord);

module.exports = router;
