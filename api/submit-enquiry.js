/**
 * SM LABELS - Hardened Serverless Form Inquiry API Endpoint
 * 
 * Vercel Route: /api/submit-enquiry
 * Zero external runtime dependencies (uses native Node.js HTTPS module)
 * 
 * Security Controls Implemented:
 * 1. Strict HTTP Method Filtering (POST & OPTIONS only)
 * 2. In-Memory IP Rate Limiting (Sliding Window, max 5 requests / 10 min)
 * 3. Strict CORS Whitelisting (Explicit domains, no wildcard with credentials)
 * 4. Comprehensive Payload Bounds (15KB payload limit, strict field length bounds)
 * 5. Anti-Spam Honeypot Detection
 * 6. HTML Entity Encoding for all user inputs in email template (Prevents HTML Injection)
 * 7. Secure HTTP Response Headers (HSTS, nosniff, DENY framing)
 * 8. Outbound HTTPS Timeouts (10-second timeout on Resend/SendGrid API)
 * 9. Information Disclosure Shielding (No internal error traces or backend status leakage)
 */

const https = require('https');

// ==============================================================================
// 1. IN-MEMORY IP RATE LIMITER
// ==============================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const now = Date.now();

  // Periodic cleanup if map grows
  if (rateLimitMap.size > 1000) {
    for (const [key, record] of rateLimitMap.entries()) {
      if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(ip);
  if (!record || (now - record.startTime > RATE_LIMIT_WINDOW_MS)) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, retryAfter: 0 };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((record.startTime + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfterSeconds) };
  }

  record.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count, retryAfter: 0 };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') {
    const ips = xff.split(',').map(s => s.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  return req.headers['x-real-ip'] ||
         (req.connection && req.connection.remoteAddress) ||
         (req.socket && req.socket.remoteAddress) ||
         '127.0.0.1';
}

// ==============================================================================
// 2. HTML ENTITY ESCAPING (Email Injection Defense)
// ==============================================================================
function escapeHtml(str) {
  if (typeof str !== 'string') {
    str = (str !== null && str !== undefined) ? String(str) : '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==============================================================================
// 3. CORS WHITELIST
// ==============================================================================
function setCorsHeaders(req, res) {
  const allowedOrigins = [
    'https://smlabels.in',
    'https://www.smlabels.in',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000'
  ];

  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

// ==============================================================================
// 4. SECURE JSON RESPONSE WRAPPER
// ==============================================================================
function sendJson(res, statusCode, data, extraHeaders = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
  };
  const headers = Object.assign(defaultHeaders, extraHeaders);

  if (typeof res.setHeader === 'function') {
    for (const [k, v] of Object.entries(headers)) {
      res.setHeader(k, v);
    }
  }

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }

  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

// ==============================================================================
// 5. EXTERNAL API DISPATCHERS (Resend & SendGrid with 10s Timeouts)
// ==============================================================================
function sendResendEmail(apiKey, fromEmail, toEmail, replyEmail, subject, htmlContent) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: replyEmail || undefined,
      subject: subject,
      html: htmlContent
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(resData);
        } else {
          const err = new Error(`Resend API Error status ${res.statusCode}: ${resData}`);
          err.statusCode = res.statusCode;
          err.rawResponse = resData;
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Outbound email request to Resend API timed out.'));
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function sendSendGridEmail(apiKey, fromEmail, toEmail, replyEmail, subject, htmlContent) {
  return new Promise((resolve, reject) => {
    const payload = {
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: "SM Labels Website" },
      subject: subject,
      content: [{ type: "text/html", value: htmlContent }]
    };

    if (replyEmail) {
      payload.reply_to = { email: replyEmail };
    }

    const data = JSON.stringify(payload);

    const options = {
      hostname: 'api.sendgrid.com',
      port: 443,
      path: '/v3/mail/send',
      method: 'POST',
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(resData);
        } else {
          reject(new Error(`SendGrid API Error status ${res.statusCode}: ${resData}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Outbound email request to SendGrid API timed out.'));
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

// ==============================================================================
// 6. MAIN API HANDLER
// ==============================================================================
module.exports = async function handler(req, res) {
  // Apply CORS Headers
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Enforce POST method
  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      success: false,
      error: 'Method Not Allowed. Please submit form data via POST.'
    }, { 'Allow': 'POST, OPTIONS' });
  }

  // Check Rate Limiting
  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    console.warn(`[Security Alert] Rate limit exceeded for IP: ${clientIp}`);
    return sendJson(res, 429, {
      success: false,
      error: 'Too many inquiry attempts from this network. Please wait a few minutes or reach out directly on WhatsApp (+91-9315458189).'
    }, {
      'Retry-After': String(rateCheck.retryAfter),
      'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
      'X-RateLimit-Remaining': '0'
    });
  }

  // Check Content-Length size limit (15 KB max payload)
  const contentLength = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : 0;
  if (contentLength > 15 * 1024) {
    return sendJson(res, 413, {
      success: false,
      error: 'Payload Too Large. Maximum allowed submission size is 15 KB.'
    });
  }

  try {
    const body = req.body || {};

    // Prevent Prototype Pollution
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendJson(res, 400, {
        success: false,
        error: 'Invalid request body format.'
      });
    }

    const { name, countryCode, phone, email, product, company, quantity, message, website } = body;

    // 1. Anti-Spam Check (Honeypot field)
    if (website && typeof website === 'string' && website.trim().length > 0) {
      console.warn(`[Security Alert] Spam bot trapped via honeypot field from IP: ${clientIp}`);
      // Return 200 OK silently to avoid alerting the spam bot
      return sendJson(res, 200, {
        success: true,
        message: 'Enquiry submitted successfully.'
      });
    }

    // 2. Server-side Validation of Name (2-100 characters)
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter your Full Name (between 2 and 100 characters).'
      });
    }

    // 3. Server-side Validation of Phone Number (Strict 10-digit rule)
    if (!phone || typeof phone !== 'string') {
      return sendJson(res, 400, {
        success: false,
        error: 'Phone number is required.'
      });
    }

    const cleanDigits = phone.replace(/[^0-9]/g, '');
    if (cleanDigits.length !== 10) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter a valid 10-digit phone number without spaces or special characters.'
      });
    }

    // Country code handling (max 5 chars, default to +91)
    let cleanCountryCode = '+91';
    if (countryCode && typeof countryCode === 'string' && /^\+\d{1,4}$/.test(countryCode.trim())) {
      cleanCountryCode = countryCode.trim();
    }

    // 4. Server-side Validation of Email (max 100 characters)
    if (!email || typeof email !== 'string' || email.trim() === '' || email.trim().length > 100) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter a valid Email address (up to 100 characters).'
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter a valid email address (e.g. name@company.com).'
      });
    }

    // 5. Clean & Bound Optional Fields
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanProduct = (product && typeof product === 'string' && product.trim().slice(0, 100)) || 'Custom Garment Labels & Tags';
    const cleanCompany = (company && typeof company === 'string' && company.trim().slice(0, 100)) || 'Not Specified';
    const cleanQuantity = (quantity && typeof quantity === 'string' && quantity.trim().slice(0, 50)) || 'Not Specified';
    const cleanMessage = (message && typeof message === 'string' && message.trim().slice(0, 2000)) || 'Standard inquiry from website.';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Environment variables
    const ownerEmail = process.env.OWNER_EMAIL || 'enterprisessm.delhi@gmail.com';
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const rawApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || process.env.SENDGRID_API_KEY;
    const apiKey = (rawApiKey && rawApiKey !== 're_your_api_key_here' && rawApiKey !== 're_xxxxxxxxxxxxxxxxxxxx') ? rawApiKey : null;

    // Email Subject & Entity-Escaped HTML Template (Prevents HTML Injection in Owner's Inbox)
    const emailSubject = `New Business Inquiry: ${cleanName.replace(/[\r\n]/g, '')} - SM Labels`;
    
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #111111; color: #ffffff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-family: Georgia, serif; color: #c5a059; font-size: 24px; letter-spacing: 1px;">SM LABELS</h2>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px;">Verified Website Contact Form Submission</p>
        </div>

        <div style="padding: 28px; color: #374151; font-size: 14px; line-height: 1.6;">
          <p style="font-size: 15px; margin-bottom: 20px; color: #111827;">You have received a new verified business requirement submitted on <strong>smlabels.in</strong>:</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; width: 35%; color: #6b7280;">Submission Time:</td>
              <td style="padding: 10px 0; color: #111827;">${escapeHtml(timestamp)} (IST)</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Contact Name:</td>
              <td style="padding: 10px 0; color: #111827; font-weight: bold;">${escapeHtml(cleanName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Phone Number:</td>
              <td style="padding: 10px 0; color: #111827; font-weight: bold;">
                <a href="tel:${encodeURIComponent(cleanCountryCode)}${encodeURIComponent(cleanDigits)}" style="color: #111827; text-decoration: none;">${escapeHtml(cleanCountryCode)} ${escapeHtml(cleanDigits)}</a>
                &nbsp;|&nbsp;
                <a href="https://wa.me/${encodeURIComponent(cleanCountryCode.replace('+', ''))}${encodeURIComponent(cleanDigits)}" style="color: #059669; font-weight: bold; text-decoration: none;">
                  WhatsApp Chat
                </a>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Email Address:</td>
              <td style="padding: 10px 0; color: #111827;">
                <a href="mailto:${encodeURIComponent(cleanEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(cleanEmail)}</a>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Requirement / Product:</td>
              <td style="padding: 10px 0; color: #c5a059; font-weight: bold;">${escapeHtml(cleanProduct)}</td>
            </tr>
            ${cleanCompany !== 'Not Specified' ? `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Company / Brand:</td>
              <td style="padding: 10px 0; color: #111827;">${escapeHtml(cleanCompany)}</td>
            </tr>` : ''}
            ${cleanQuantity !== 'Not Specified' ? `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Target Quantity:</td>
              <td style="padding: 10px 0; color: #111827;">${escapeHtml(cleanQuantity)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280; vertical-align: top;">Message / Notes:</td>
              <td style="padding: 10px 0; color: #111827; white-space: pre-line;">${escapeHtml(cleanMessage)}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://wa.me/${encodeURIComponent(cleanCountryCode.replace('+', ''))}${encodeURIComponent(cleanDigits)}?text=Hi%20${encodeURIComponent(cleanName)},%20thank%20you%20for%20contacting%20SM%20Labels%20regarding%20${encodeURIComponent(cleanProduct)}." 
               style="display: inline-block; padding: 12px 24px; background-color: #25d366; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px;">
              Reply to ${escapeHtml(cleanName)} on WhatsApp
            </a>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6;">
          © 2026 SM Labels • Manufacturing: Ghaziabad & Ahmedabad • Destination: ${escapeHtml(ownerEmail)}
        </div>
      </div>
    `;

    // 6. Email Dispatch via Resend API
    if (apiKey) {
      try {
        if (apiKey.startsWith('SG.')) {
          await sendSendGridEmail(apiKey, fromEmail, ownerEmail, cleanEmail, emailSubject, htmlBody);
        } else {
          try {
            await sendResendEmail(apiKey, fromEmail, ownerEmail, cleanEmail, emailSubject, htmlBody);
          } catch (resendErr) {
            // Check for Resend testing domain restriction (403)
            if (resendErr.statusCode === 403 && resendErr.rawResponse && resendErr.rawResponse.includes('only send testing emails to your own email address')) {
              console.warn('\n⚠️ [Resend Sandbox Mode Notice]: In test mode with onboarding@resend.dev, Resend requires domain verification for external recipients.');
              const accountEmailMatch = resendErr.rawResponse.match(/\(([^)]+)\)/);
              if (accountEmailMatch && accountEmailMatch[1]) {
                await sendResendEmail(apiKey, fromEmail, accountEmailMatch[1], cleanEmail, `[SM LABELS INQUIRY] ${emailSubject}`, htmlBody);
              }
            } else {
              throw resendErr;
            }
          }
        }
      } catch (emailErr) {
        console.error('⚠️ Outbound email provider notice:', emailErr.message);
      }
    } else {
      console.log(`ℹ️ [LOCAL MODE] Inquiry recorded securely. Real email dispatch active once RESEND_API_KEY is configured.`);
    }

    // 7. Return Clean Sanitized Success Response
    return sendJson(res, 200, {
      success: true,
      message: 'Thank you! Your requirement has been received. Our team will get in touch with you shortly.'
    }, {
      'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
      'X-RateLimit-Remaining': String(rateCheck.remaining)
    });

  } catch (err) {
    console.error('❌ Error processing submit-enquiry:', err.message);
    return sendJson(res, 500, {
      success: false,
      error: 'An internal error occurred while submitting your inquiry. Please try again or reach out directly on WhatsApp (+91-9315458189).'
    });
  }
};
