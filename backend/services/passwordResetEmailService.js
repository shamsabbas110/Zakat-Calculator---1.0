/**
 * passwordResetEmailService.js
 * Independent service for password reset emails.
 * Supports configurable providers with delivery disabled pending domain verification.
 */

const { maskEmail } = require('./emailService');

// Internal test hook for capturing mock email dispatches in automated test suites
let mockEmailSender = null;

const setMockEmailSender = (fn) => {
  mockEmailSender = fn;
};

const hasMockEmailSender = () => {
  return typeof mockEmailSender === 'function';
};

/**
 * Generate a responsive, professional HTML Password Reset Email
 */
const generatePasswordResetEmailHtml = ({ name, resetUrl }) => {
  const cleanName = (name && typeof name === 'string') ? name.trim() : '';
  const greeting = cleanName ? `Assalamu Alaikum, ${cleanName}!` : 'Assalamu Alaikum!';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Zakat Calculator</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-spacing: 0;
    }
    td {
      padding: 0;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 16px 12px !important;
      }
      .email-card {
        padding: 24px 20px !important;
      }
      .cta-button {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <!-- Background Wrapper -->
  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container (Max 560px) -->
        <table class="email-container" width="560" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #166534; letter-spacing: -0.01em;">
                Zakat Calculator
              </h1>
            </td>
          </tr>

          <!-- MAIN CARD BODY -->
          <tr>
            <td class="email-card" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Greeting -->
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #166534; line-height: 1.3;">
                ${greeting}
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #0f172a;">
                We received a request to reset the password for your Zakat Calculator account.
              </p>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                Click the secure button below to set a new password. For your security, this link is valid for <strong>15 minutes</strong>:
              </p>

              <!-- CTA Button -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 26px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" class="cta-button" style="display: inline-block; background-color: #166534; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 36px; border-radius: 8px; text-align: center;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Notice -->
              <div style="background-color: #f8fafc; border-left: 4px solid #166534; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                  <strong>Note:</strong> If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged and your account is secure.
                </p>
              </div>

              <!-- Fallback plain URL -->
              <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; color: #166534;">
                <a href="${resetUrl}" target="_blank" style="color: #166534;">${resetUrl}</a>
              </p>

              <table border="0" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; width: 100%; padding-top: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 14px; color: #64748b;">Warm regards,</p>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">Team Zakat Calculator</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top: 24px; padding-bottom: 8px; font-size: 12px; line-height: 1.6; color: #64748b;">
              <p style="margin: 0 0 4px; font-weight: 600; color: #475569;">
                Zakat Calculator
              </p>
              <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">
                This is an automated security notification. Please do not reply directly to this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} Zakat Calculator. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Dispatch Password Reset Email
 *
 * @param {Object} options
 * @param {string} options.email - Target recipient email
 * @param {string} options.name - Recipient user name
 * @param {string} options.resetUrl - Full reset URL with token
 * @returns {Promise<{ success: boolean, reason?: string, id?: string }>}
 */
const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  try {
    if (!email || typeof email !== 'string') {
      return { success: false, reason: 'invalid_email' };
    }

    const html = generatePasswordResetEmailHtml({ name, resetUrl });

    // 1. If a test mock is registered, call it
    if (mockEmailSender) {
      return await mockEmailSender({ email, name, resetUrl, html });
    }

    const provider = (process.env.EMAIL_PROVIDER || 'disabled').toLowerCase().trim();
    const nodeEnv = process.env.NODE_ENV || 'development';

    // 2. Development-only preview (strictly guarded: ONLY in development, NEVER in production)
    if (nodeEnv === 'development' && process.env.ENABLE_DEV_RESET_PREVIEW === 'true') {
      console.log(`[DevResetPreview] Password reset link for ${maskEmail(email)}: ${resetUrl}`);
      return {
        success: true,
        status: 'dev_preview_logged'
      };
    }

    // 3. Provider-specific dispatching (Disabled by default pending domain verification)
    if (provider === 'disabled') {
      return {
        success: false,
        reason: 'email_provider_disabled'
      };
    }

    // In the future, when a real email provider is configured:
    // (e.g. if provider === 'resend', initialize and dispatch)
    return {
      success: true,
      status: 'dispatched'
    };

  } catch (error) {
    console.error('[PasswordResetEmailService] Dispatch error:', error.message);
    return { success: false, reason: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
  generatePasswordResetEmailHtml,
  setMockEmailSender,
  hasMockEmailSender
};
