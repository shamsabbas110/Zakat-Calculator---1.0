const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'zakat_calc_default_secure_secret_2026';

/**
 * Authentication Middleware
 * Enforces JWT authentication on private routes.
 * Decodes user token and attaches req.user and req.userId to the request.
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization required. Please log in to continue.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token missing.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid session token. Please log in again.'
      });
    }

    const user = await User.findById(decoded.id).select('-password +passwordChangedAt');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been removed.'
      });
    }

    // Revoke token if password was changed after this token was issued
    if (user.passwordChangedAt && decoded.iat) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          success: false,
          message: 'Password was changed recently. Please log in again.'
        });
      }
    }

    // Attach authenticated user information
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication verification.'
    });
  }
};

/**
 * Optional Auth Middleware
 * If token is present, sets req.user and req.userId.
 * If token is absent, proceeds without failing.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
          req.userId = user._id;
        }
      }
    }
    next();
  } catch (err) {
    // In optional auth, continue even if token is invalid or expired
    next();
  }
};

/**
 * Admin Only Guard
 * Ensures only users with role === 'admin' can access admin actions.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin privileges required.'
    });
  }
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin
};
