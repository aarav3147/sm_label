/**
 * SM LABELS - Google Apps Script for Form Inquiries
 * 
 * Target Email: enterprisessm.delhi@gmail.com
 * 
 * INSTRUCTIONS:
 * 1. Open Google Sheets (https://sheets.google.com) and create a new Spreadsheet named "SM Labels Inquiries".
 * 2. Go to Extensions > Apps Script.
 * 3. Replace all code in Code.gs with this script.
 * 4. Update RECIPIENT_EMAIL if needed (default: enterprisessm.delhi@gmail.com).
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app".
 * 7. Set "Execute as": "Me".
 * 8. Set "Who has access": "Anyone".
 * 9. Click "Deploy", copy the Web App URL, and paste it into js/app.js (GOOGLE_APPS_SCRIPT_URL).
 */

const RECIPIENT_EMAIL = "enterprisessm.delhi@gmail.com";

function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter || {};
    }

    const name = data.name || "N/A";
    const phone = data.phone || "N/A";
    const email = data.email || "Not Provided";
    const product = data.product || "General Inquiry";
    const notes = data.notes || "None";
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // 1. Save to Active Google Sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Create header row if empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Full Name", "Phone Number", "Email Address", "Product Requirement", "Notes / Quantity"]);
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f4f6");
    }
    
    sheet.appendRow([timestamp, name, phone, email, product, notes]);

    // 2. Send Formatted Email Notification to enterprisessm.delhi@gmail.com
    const emailSubject = `🔔 New SM Labels Inquiry: ${name} (${product})`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #111111; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; color: #c5a059;">SM LABELS - New Inquiry Received</h2>
        </div>
        <div style="padding: 20px; color: #374151;">
          <p style="font-size: 16px; margin-bottom: 20px;">You have received a new customer inquiry from the SM Labels website.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; width: 35%; border-bottom: 1px solid #eee;">Timestamp:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${timestamp}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Full Name:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Phone / WhatsApp:</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}">${phone}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Product Interest:</td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #c5a059; font-weight: bold;">${product}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Notes / Quantity:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${notes}</td></tr>
          </table>
          <div style="margin-top: 25px; text-align: center;">
            <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(name)},%20thank%20you%20for%20contacting%20SM%20Labels%20regarding%20${encodeURIComponent(product)}." 
               style="display: inline-block; padding: 12px 24px; background-color: #25d366; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 6px;">
              Reply via WhatsApp (+91-9315458189)
            </a>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 12px; text-align: center; font-size: 12px; color: #9ca3af;">
          © 2026 SM Labels • enterprisessm.delhi@gmail.com
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: RECIPIENT_EMAIL,
      subject: emailSubject,
      htmlBody: emailBody
    });

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", message: "Inquiry logged and email sent" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("SM Labels Apps Script Web App is running.");
}
