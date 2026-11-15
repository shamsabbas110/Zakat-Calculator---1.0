const express = require('express');
const router = express.Router();
const {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { forgotPasswordLimiter, resetPasswordLimiter } = require('../middleware/rateLimiter');

// Public authentication routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/google/login', (req, res) => { req.body.mode = 'login'; return googleAuth(req, res); });
router.post('/google/signup', (req, res) => { req.body.mode = 'signup'; return googleAuth(req, res); });

// Password Reset routes (rate-limited)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);

// Protected routes (require valid JWT)
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);

module.exports = router;
