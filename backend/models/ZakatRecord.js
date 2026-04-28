const mongoose = require('mongoose');

const zakatRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional, can be linked to authentication later
  },
  type: {
    type: String,
    default: 'Current Zakat'
  },
  totalWealth: {
    type: Number,
    required: true
  },
  zakatAmount: {
    type: Number,
    required: true
  },
  gregorianDate: {
    type: String, // The date the wealth reached Nisab
    required: false
  },
  hijriDate: {
    type: String, // The Hijri equivalent
    required: false
  },
  nextDueDateGregorian: {
    type: String, // 354 days from calculation
    required: false
  },
  nextDueDateHijri: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ZakatRecord', zakatRecordSchema);
