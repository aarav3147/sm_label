/**
 * SM LABELS - Serverless Form Inquiry API Endpoint
 * 
 * Vercel Route: /api/submit-enquiry
 * Zero external dependencies (uses native Node.js HTTPS module for API email delivery)
 * 
 * Environment Variables required in Vercel:
 * - OWNER_EMAIL      (e.g., enterprisessm.delhi@gmail.com)
 * - FROM_EMAIL       (e.g., website@smlabels.in or onboarding@resend.dev)
 * - EMAIL_API_KEY    (Transactional email API key for Resend or SendGrid)
 */

const https = require('https');

/**
 * Configure dynamic CORS headers for Production (smlabels.in) & Local Dev
 */
function setCorsHeaders(req, res) {
  const allowedOrigins = [
    'https://smlabels.in',
    'https://www.smlabels.in',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5500'
  ];

  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://smlabels.in');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With');
}

/**
 * Send email via Resend API using native Node HTTPS
 */
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
          reject(new Error(`Resend API Error status ${res.statusCode}: ${resData}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Send email via SendGrid API using native Node HTTPS
 */
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

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // Apply CORS Headers
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Please submit form data via POST.'
    });
  }

  try {
    const body = req.body || {};
    const { name, company, email, phone, product, quantity, message, website } = body;

    // 1. Anti-Spam Check (Honeypot field)
    if (website && typeof website === 'string' && website.trim().length > 0) {
      console.warn('🤖 Spam bot trapped via honeypot field.');
      return res.status(200).json({
        success: true,
        message: 'Enquiry submitted successfully.'
      });
    }

    // 2. Validation of Required Fields
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid Name (minimum 2 characters).'
      });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid Phone / WhatsApp number.'
      });
    }

    // Optional Email Format Validation if provided
    if (email && typeof email === 'string' && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid Email address or leave it blank.'
        });
      }
    }

    // Cleaned form field values
    const cleanName = name.trim();
    const cleanCompany = (company && company.trim()) || 'Not Specified';
    const cleanPhone = phone.trim();
    const cleanEmail = (email && email.trim()) || 'Not Provided';
    const cleanProduct = (product && product.trim()) || 'General Requirement';
    const cleanQuantity = (quantity && quantity.trim()) || 'Not Specified';
    const cleanMessage = (message && message.trim()) || 'No additional project details provided.';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Environment variables
    const ownerEmail = process.env.OWNER_EMAIL || 'enterprisessm.delhi@gmail.com';
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;

    // Email Subject & HTML Template
    const emailSubject = `New Website Enquiry - SM Labels`;
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #111111; color: #ffffff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-family: Georgia, serif; color: #c5a059; font-size: 24px; letter-spacing: 1px;">SM LABELS</h2>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px;">New Website Enquiry Notification</p>
        </div>

        <div style="padding: 28px; color: #374151; font-size: 14px; line-height: 1.6;">
          <p style="font-size: 15px; margin-bottom: 22px; color: #111827;">You have received a new business inquiry submitted via <strong>smlabels.in</strong>:</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; width: 35%; color: #6b7280;">Submission Time:</td>
              <td style="padding: 10px 0; color: #111827;">${timestamp}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Visitor Name:</td>
              <td style="padding: 10px 0; color: #111827; font-weight: bold;">${cleanName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Company Name:</td>
              <td style="padding: 10px 0; color: #111827;">${cleanCompany}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Phone / WhatsApp:</td>
              <td style="padding: 10px 0; color: #111827;">
                <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}" style="color: #059669; font-weight: bold; text-decoration: none;">
                  ${cleanPhone} (Click to Chat)
                </a>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Email Address:</td>
              <td style="padding: 10px 0; color: #111827;">
                ${cleanEmail !== 'Not Provided' ? `<a href="mailto:${cleanEmail}" style="color: #2563eb;">${cleanEmail}</a>` : 'Not Provided'}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Product Requirement:</td>
              <td style="padding: 10px 0; color: #c5a059; font-weight: bold;">${cleanProduct}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Target Quantity:</td>
              <td style="padding: 10px 0; color: #111827;">${cleanQuantity}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280; vertical-align: top;">Message / Notes:</td>
              <td style="padding: 10px 0; color: #111827; white-space: pre-line;">${cleanMessage}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 28px;">
            <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(cleanName)},%20thank%20you%20for%20contacting%20SM%20Labels%20regarding%20${encodeURIComponent(cleanProduct)}." 
               style="display: inline-block; padding: 12px 24px; background-color: #25d366; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px;">
              Reply directly on WhatsApp (+91-9315458189)
            </a>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-t: 1px solid #f3f4f6;">
          © 2026 SM Labels • Website Notification System • <a href="https://smlabels.in" style="color: #6b7280;">smlabels.in</a>
        </div>
      </div>
    `;

    // 3. Dispatch Email Notification via API
    let deliveryMethod = 'none';

    if (apiKey) {
      const replyEmail = cleanEmail !== 'Not Provided' ? cleanEmail : undefined;
      
      if (apiKey.startsWith('SG.')) {
        await sendSendGridEmail(apiKey, fromEmail, ownerEmail, replyEmail, emailSubject, htmlBody);
        deliveryMethod = 'sendgrid';
      } else {
        // Default to Resend API
        await sendResendEmail(apiKey, fromEmail, ownerEmail, replyEmail, emailSubject, htmlBody);
        deliveryMethod = 'resend';
      }
    } else {
      console.warn('⚠️ EMAIL_API_KEY missing in environment variables. Enquiry logged without sending email.');
      deliveryMethod = 'logged_only';
    }

    // 4. Return Successful JSON Response
    return res.status(200).json({
      success: true,
      message: 'Enquiry submitted successfully! Our team will contact you shortly.',
      data: {
        name: cleanName,
        product: cleanProduct,
        deliveryMethod: deliveryMethod
      }
    });

  } catch (err) {
    console.error('❌ Error processing submit-enquiry:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while submitting your enquiry. Please try again or reach out on WhatsApp.'
    });
  }
};
