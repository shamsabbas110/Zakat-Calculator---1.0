const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  // We use an object to store past wealth as requested (not an array)
  // This allows the frontend to send data like { year1: 50000, year2: 60000 }
  wealthHistory: {
    type: Map,
    of: Number, // The values will be the wealth amount (Number)
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
