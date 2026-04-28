const mongoose = require('mongoose');

const pastZakatRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
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
