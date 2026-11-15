/**
 * rateLimiter.js
 * In-memory sliding window rate limiter for security-sensitive authentication endpoints.
 * Zero external dependencies.
 */

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes default
  max = 5,                    // 5 attempts per window default
  message = 'Too many requests. Please try again later.'
}) => {
  const requests = new Map();

  // Periodic cleanup to avoid memory leaks (runs every 5 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.startTime > windowMs) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref(); // Don't prevent Node process from exiting
  }

  return (req, res, next) => {
    // In test environment, allow explicit bypass header for non-rate-limit tests
    if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'true') {
      return next();
    }

    // Identify client by IP (or forwarded IP if behind proxy)
    const clientIp = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : (req.socket?.remoteAddress || req.ip || 'unknown');

    const key = `${req.baseUrl || ''}${req.path}_${clientIp}`;
    const now = Date.now();

    if (!requests.has(key)) {
      requests.set(key, { count: 1, startTime: now });
      return next();
    }

    const record = requests.get(key);

    // If window expired, reset
    if (now - record.startTime > windowMs) {
      record.count = 1;
      record.startTime = now;
      return next();
    }

    // Increment request count
    record.count++;

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.startTime + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message
      });
    }

    next();
  };
};

// Specialized limiter for forgot password requests (5 per 15 minutes)
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests from this IP. Please try again after 15 minutes.'
});

// Specialized limiter for reset password verification (10 per 15 minutes)
const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many reset attempts from this IP. Please try again after 15 minutes.'
});

module.exports = {
  createRateLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
};
