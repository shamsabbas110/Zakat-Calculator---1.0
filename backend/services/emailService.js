/**
 * emailService.js
 * Transactional Email Service for Zakat Calculator (disabled)
 */

/**
 * Mask email address for privacy-safe logging (e.g., sh***@example.com)
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.substring(0, 2)}***` : `${name.charAt(0)}***`;
  return `${maskedName}@${domain}`;
};

/**
 * Welcome email stub (email sending disabled)
 */
const sendWelcomeEmail = async () => {
  return { success: false, reason: 'email_disabled' };
};

module.exports = {
  maskEmail,
  sendWelcomeEmail
};
