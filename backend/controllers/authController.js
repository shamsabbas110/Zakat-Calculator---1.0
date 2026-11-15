const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { sendPasswordResetEmail, hasMockEmailSender } = require('../services/passwordResetEmailService');

const JWT_SECRET = process.env.JWT_SECRET || 'zakat_calc_default_secure_secret_2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
// RFC-compliant email regex: rejects abc, test@, @gmail.com, user@gmail, user@@gmail.com
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Generate standard JWT Token for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Register with Email and Password
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Full Name Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters.' });
    }
    if (trimmedName.length > 80) {
      return res.status(400).json({ success: false, message: 'Full name cannot exceed 80 characters.' });
    }

    // 2. Email Validation & Normalization
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // 3. Password Validation (Never trim password)
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Password cannot be empty or whitespace only.'
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }
    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'Password cannot exceed 128 characters.'
      });
    }

    // 4. Duplicate Check (HTTP 409 Conflict)
    const existingUser = await User.findOne({ email: normalizedEmail }).select('+password');
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email is already registered. Please log in.'
      });
    }

    // 5. Secure Password Hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Create User Record
    const newUser = new User({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: 'local',
      role: 'user' // Default to normal user, never admin
    });

    await newUser.save();

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        role: newUser.role,
        authProvider: newUser.authProvider
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.'
    });
  }
};

/**
 * Login with Email and Password
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic Presence Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials format.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length > 128) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 2. Find User by Normalized Email
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 3. Check for Google-authenticated user without a local password
    if (!user.password) {
      if (user.authProvider === 'google' || user.googleId) {
        return res.status(400).json({
          success: false,
          message: 'This email is linked to Google Sign-In. Please click "Continue with Google".'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 4. Verify Password with bcrypt.compare
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 5. Issue JWT on Success
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during login.'
    });
  }
};

/**
 * Verify Google ID Token Helper
 */
const verifyGoogleIdToken = async (credential) => {
  // Support mock tokens strictly in test mode for automated test suites
  if (process.env.NODE_ENV === 'test' && typeof credential === 'string' && credential.startsWith('mock_google_token:')) {
    const raw = credential.replace('mock_google_token:', '');
    return JSON.parse(raw);
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID || undefined
  });
  return ticket.getPayload();
};

/**
 * Google OAuth Authentication (Separate Login and Sign Up Flows)
 * POST /api/auth/google
 * Body: { credential, mode: 'login' | 'signup' }
 */
const googleAuth = async (req, res) => {
  try {
    const credential = req.body.credential || req.body.idToken || req.body.token;
    const mode = (req.body.mode || 'login').toLowerCase().trim();

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token credential is required.'
      });
    }

    let payload;
    try {
      // Verify token cryptographically with Google's public certificates
      payload = await verifyGoogleIdToken(credential);
    } catch (verifyError) {
      console.error('Google Token Verification Failed:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed: Invalid or expired token.'
      });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google account does not provide an email address.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists by googleId OR by email
    let user = await User.findOne({
      $or: [{ googleId }, { email: normalizedEmail }]
    });

    // ─────────────────────────────────────────────────────────────
    // FLOW 1: SIGN UP (Registration)
    // ─────────────────────────────────────────────────────────────
    if (mode === 'signup' || mode === 'register') {
      if (user) {
        return res.status(400).json({
          success: false,
          message: 'Account already exists. Please log in.'
        });
      }

      // Create new Google-authenticated user
      // Role is ALWAYS 'user' — Google sign-in never inherits admin privileges
      user = new User({
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        googleId,
        avatar: picture || '',
        authProvider: 'google',
        role: 'user'
      });

      await user.save();

      const token = generateToken(user);

      return res.status(201).json({
        success: true,
        message: 'Google account created successfully.',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          authProvider: user.authProvider
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FLOW 2: LOGIN
    // ─────────────────────────────────────────────────────────────
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please create an account first.'
      });
    }

    // Account exists: link googleId and update avatar if needed
    let hasChanges = false;

    if (!user.googleId) {
      user.googleId = googleId;
      hasChanges = true;
    }
    if (!user.avatar && picture) {
      user.avatar = picture;
      hasChanges = true;
    }
    if (!user.name && name) {
      user.name = name;
      hasChanges = true;
    }

    if (hasChanges) {
      await user.save();
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during Google authentication.'
    });
  }
};

/**
 * Get Current Authenticated User Profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    // req.user is populated by requireAuth middleware
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        role: req.user.role,
        authProvider: req.user.authProvider,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching user profile.'
    });
  }
};

/**
 * Update Profile Name or Avatar
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name && typeof name === 'string' && name.trim()) {
      if (name.trim().length > 100) {
        return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters.' });
      }
      user.name = name.trim();
    }
    if (avatar !== undefined && typeof avatar === 'string') {
      user.avatar = avatar;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        authProvider: user.authProvider
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating profile.'
    });
  }
};

/**
 * Forgot Password - Generate Reset Token & Dispatch Email
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password +resetPasswordToken +resetPasswordExpires');
    // Google-only account check: cannot reset non-existent password
    if (user && user.authProvider === 'google' && !user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account was created with Google Sign-In and does not use a password. Please sign in with Google.'
      });
    }

    // Delivery Guard: Check if email delivery or development preview is active
    const provider = (process.env.EMAIL_PROVIDER || 'disabled').toLowerCase().trim();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevPreview = nodeEnv === 'development' && process.env.ENABLE_DEV_RESET_PREVIEW === 'true';
    const isMockActive = hasMockEmailSender();
    const isEmailEnabled = provider !== 'disabled';

    // If email delivery is disabled, dev preview is not active, and no test mock is registered:
    // Do NOT generate a token in DB. Do NOT claim an email was sent. Return clear unavailable message.
    if (!isEmailEnabled && !isDevPreview && !isMockActive) {
      return res.status(503).json({
        success: false,
        message: 'Password reset via email is temporarily unavailable. Please contact support or try again later.'
      });
    }

    const genericSuccessResponse = {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    };

    if (!user) {
      // Always return generic response to prevent account enumeration
      return res.status(200).json(genericSuccessResponse);
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store only SHA-256 hash in database
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Build reset link using configured frontend URL
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

    // Dispatch email
    const dispatchResult = await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl
    });

    // If email delivery fails, safely rollback token in DB immediately
    if (!dispatchResult || dispatchResult.success === false) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    return res.status(200).json(genericSuccessResponse);

  } catch (error) {
    console.error('Forgot Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing your password reset request.'
    });
  }
};

/**
 * Reset Password - Verify Token & Set New Password
 * POST /api/auth/reset-password/:token
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required.'
      });
    }

    // Validate new password (min 8, max 128 characters)
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Password cannot be empty or whitespace only.'
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }
    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'Password cannot exceed 128 characters.'
      });
    }

    // Hash received token with SHA-256 to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Query unexpired matching token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password +resetPasswordToken +resetPasswordExpires +passwordChangedAt');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token.'
      });
    }

    // Hash new password using bcrypt
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Enforce single-use: clear token and expiration fields immediately
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Invalidate existing JWT sessions issued prior to this change
    user.passwordChangedAt = new Date();

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.'
    });

  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password.'
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword
};
