// In-memory mailbox used during testing and development simulation
export const testMailbox = [];

/**
 * Get configured client application base URL for verification links.
 */
export const getClientBaseUrl = () => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.CLIENT_URL) {
    const firstOrigin = process.env.CLIENT_URL.split(',')[0].trim().replace(/\/$/, '');
    if (firstOrigin && firstOrigin !== '*') {
      return firstOrigin;
    }
  }
  return 'http://localhost:5173';
};

/**
 * Sends an email verification link to a user via the Resend HTTPS API.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} username - Recipient username
 * @param {string} rawToken - Single-use raw verification token (64-char hex)
 */
export const sendVerificationEmail = async (toEmail, username, rawToken) => {
  const baseUrl = getClientBaseUrl();
  const verificationUrl = `${baseUrl}/#/verify-email?token=${rawToken}`;
  const fromEmail = process.env.EMAIL_FROM || 'CodeSpeed <onboarding@resend.dev>';
  const apiKey = process.env.RESEND_API_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  const subject = 'Verify your CodeSpeed account';
  const textBody = `Hello ${username},

Thank you for creating an account on CodeSpeed!

Please verify your email address by visiting the following link within 24 hours:
${verificationUrl}

If you did not create a CodeSpeed account, you can safely ignore this email.

Happy coding,
The CodeSpeed Team`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your CodeSpeed account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #0d1117; border: 1px solid #21262d; border-radius: 8px; padding: 32px; text-align: left;">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #21262d;">
              <span style="font-family: monospace; font-size: 20px; font-weight: bold; color: #3b82f6;">&gt;_ CodeSpeed</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="margin: 0 0 16px 0; color: #f8fafc; font-size: 20px;">Verify your email address</h2>
              <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Welcome, <strong>${username}</strong>! Please confirm your email address to activate your CodeSpeed developer profile and begin racing.
              </p>
              <div style="margin: 28px 0;">
                <a href="${verificationUrl}" style="background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                Or copy and paste this verification URL into your browser:
              </p>
              <p style="margin: 0 0 24px 0; font-family: monospace; font-size: 12px; color: #38bdf8; word-break: break-all;">
                ${verificationUrl}
              </p>
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px solid #21262d; padding-top: 16px;">
                This link will expire in 24 hours. If you did not create a CodeSpeed account, no further action is needed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  // Strict check: if no API key is configured
  if (!apiKey) {
    if (isProduction) {
      console.error('[EmailService] Resend API key (RESEND_API_KEY) missing in production environment.');
      const err = new Error('Email service is currently unavailable.');
      err.code = 'EMAIL_DELIVERY_FAILED';
      throw err;
    }

    // Local development or automated test fallback simulation
    testMailbox.push({
      to: toEmail,
      username,
      rawToken,
      verificationUrl,
      sentAt: new Date(),
    });

    return { success: true, simulated: true };
  }

  // Execute delivery through Resend HTTPS API with fast-abort timeout
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CodeSpeed-Server',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        text: textBody,
        html: htmlBody,
      }),
      signal: AbortSignal.timeout(10000), // 10-second fast-abort timeout
    });

    if (!response.ok) {
      console.error('[EmailService] Resend HTTP API rejected request with status:', response.status);
      const deliveryErr = new Error('Failed to deliver verification email through email provider.');
      deliveryErr.code = 'EMAIL_DELIVERY_FAILED';
      throw deliveryErr;
    }

    const data = await response.json();

    if (process.env.NODE_ENV === 'test') {
      testMailbox.push({
        to: toEmail,
        username,
        rawToken,
        verificationUrl,
        sentAt: new Date(),
      });
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    if (err.code === 'EMAIL_DELIVERY_FAILED') {
      throw err;
    }
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    console.error('[EmailService] Resend delivery failure:', isTimeout ? 'Request timed out after 10s' : 'Network/connection error');
    const deliveryErr = new Error('Failed to deliver verification email through email provider.');
    deliveryErr.code = 'EMAIL_DELIVERY_FAILED';
    throw deliveryErr;
  }
};

export default {
  sendVerificationEmail,
  testMailbox,
  getClientBaseUrl,
};
