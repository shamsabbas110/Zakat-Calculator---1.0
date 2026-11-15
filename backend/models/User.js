const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false, // Optional for users who register via Google OAuth
    select: false    // Exclude password hash from standard queries
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true     // Sparse index allows documents without googleId
  },
  avatar: {
    type: String,
    default: ''
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  passwordChangedAt: {
    type: Date,
    select: false
  },
  // We use an object to store past wealth as requested (not an array)
  wealthHistory: {
    type: Map,
    of: Number,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
