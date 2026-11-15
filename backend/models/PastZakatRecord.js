const mongoose = require('mongoose');

const pastZakatRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional to preserve existing legacy records
    index: true
  },
  username: {
    type: String,
    required: false, // User identity snapshot
    trim: true
  },
  userEmail: {
    type: String,
    required: false, // User identity snapshot
    lowercase: true,
    trim: true
  },
  type: {
    type: String,
    default: 'Missed Zakat'
  },
  totalWealth: {
    type: Number,
    required: true
  },
  zakatAmount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PastZakatRecord', pastZakatRecordSchema);
