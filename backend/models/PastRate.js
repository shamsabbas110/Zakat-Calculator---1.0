const mongoose = require('mongoose');

const pastRateSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  day: {
    type: String,
    required: true
  },
  hijriDate: {
    type: String,
    required: true,
    index: true
  },
  goldRatePerGram: {
    type: Number,
    required: true
  },
  silverRatePerGram: {
    type: Number,
    required: true
  },
  isCarriedForward: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'past_5_year_rates_2021_to_2026'
});

module.exports = mongoose.model('PastRate', pastRateSchema);
