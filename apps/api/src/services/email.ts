import sgMail from '@sendgrid/mail';
import { env, isDev } from '../config/env.js';
import {
  formatCurrency,
  formatDimensions,
  formatDuration,
  formatFileSize,
  type QuoteSubmission,
  type PriceBreakdown,
} from '@printforge/shared';

// Initialize SendGrid
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email using SendGrid
 */
async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!env.SENDGRID_API_KEY) {
    if (isDev) {
      console.log('📧 Email would be sent (SendGrid not configured):');
      console.log(`  To: ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
      console.log(`  Body:\n${options.text}`);
    }
    return;
  }

  try {
    await sgMail.send({
      to: options.to,
      from: {
        email: env.EMAIL_FROM,
        name: env.EMAIL_FROM_NAME,
      },
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send quote notification to shop owner
 */
export async function sendOwnerNotification(
  ownerEmail: string,
  submission: QuoteSubmission,
  breakdown: PriceBreakdown,
  downloadUrl: string,
  adminUrl: string
): Promise<void> {
  const dimensions = submission.bboxX && submission.bboxY && submission.bboxZ
    ? formatDimensions(submission.bboxX, submission.bboxY, submission.bboxZ)
    : 'Not available';

  const printTime = submission.printTimeSeconds
    ? formatDuration(submission.printTimeSeconds)
    : 'Not available';

  const textContent = `
New 3D Print Quote Request

Customer Details
────────────────
Name: ${submission.customerName}
Email: ${submission.customerEmail}
Phone: ${submission.customerPhone || 'Not provided'}

Print Details
────────────────
Material: ${submission.material}
Colour: ${submission.colour}
Quality: ${submission.quality}
Infill: ${submission.infill}%
Quantity: ${submission.quantity}

File Information
────────────────
File Name: ${submission.fileName}
File Size: ${formatFileSize(submission.fileSize)}
Dimensions: ${dimensions}
Print Time (est.): ${printTime}
Filament (est.): ${submission.filamentGrams?.toFixed(1) || 'N/A'}g

Price Estimate
────────────────
Material Cost: ${formatCurrency(breakdown.materialCost)}
Machine Time: ${formatCurrency(breakdown.timeCost)}
Setup/Labour: ${formatCurrency(breakdown.labourCost)}
Subtotal: ${formatCurrency(breakdown.subtotal)}
${breakdown.quantityDiscount > 0 ? `Quantity Discount: -${formatCurrency(breakdown.quantityDiscount)}\n` : ''}Markup: ${formatCurrency(breakdown.markup)}
────────────────
Estimated Total: ${formatCurrency(breakdown.estimateLow)} - ${formatCurrency(breakdown.estimateHigh)}

Customer Notes
────────────────
${submission.notes || 'No additional notes'}

Actions
────────────────
Download Model: ${downloadUrl}
View in Dashboard: ${adminUrl}

This is an automated email from PrintForge.
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 24px; }
    h2 { color: #444; font-size: 16px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .section { margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .label { color: #666; }
    .value { font-weight: 500; }
    .total-row { font-size: 18px; font-weight: 600; color: #1a1a1a; border-top: 2px solid #333; padding-top: 12px; margin-top: 12px; }
    .notes { background: #f9f9f9; padding: 12px; border-radius: 4px; margin-top: 8px; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-right: 12px; margin-top: 16px; }
    .btn-secondary { background: #6b7280; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <h1>🖨️ New 3D Print Quote Request</h1>

  <div class="section">
    <h2>Customer Details</h2>
    <div class="row"><span class="label">Name:</span><span class="value">${submission.customerName}</span></div>
    <div class="row"><span class="label">Email:</span><span class="value">${submission.customerEmail}</span></div>
    <div class="row"><span class="label">Phone:</span><span class="value">${submission.customerPhone || 'Not provided'}</span></div>
  </div>

  <div class="section">
    <h2>Print Details</h2>
    <div class="row"><span class="label">Material:</span><span class="value">${submission.material}</span></div>
    <div class="row"><span class="label">Colour:</span><span class="value">${submission.colour}</span></div>
    <div class="row"><span class="label">Quality:</span><span class="value">${submission.quality}</span></div>
    <div class="row"><span class="label">Infill:</span><span class="value">${submission.infill}%</span></div>
    <div class="row"><span class="label">Quantity:</span><span class="value">${submission.quantity}</span></div>
  </div>

  <div class="section">
    <h2>File Information</h2>
    <div class="row"><span class="label">File Name:</span><span class="value">${submission.fileName}</span></div>
    <div class="row"><span class="label">File Size:</span><span class="value">${formatFileSize(submission.fileSize)}</span></div>
    <div class="row"><span class="label">Dimensions:</span><span class="value">${dimensions}</span></div>
    <div class="row"><span class="label">Print Time (est.):</span><span class="value">${printTime}</span></div>
    <div class="row"><span class="label">Filament (est.):</span><span class="value">${submission.filamentGrams?.toFixed(1) || 'N/A'}g</span></div>
  </div>

  <div class="section">
    <h2>Price Estimate</h2>
    <div class="row"><span class="label">Material Cost:</span><span class="value">${formatCurrency(breakdown.materialCost)}</span></div>
    <div class="row"><span class="label">Machine Time:</span><span class="value">${formatCurrency(breakdown.timeCost)}</span></div>
    <div class="row"><span class="label">Setup/Labour:</span><span class="value">${formatCurrency(breakdown.labourCost)}</span></div>
    <div class="row"><span class="label">Subtotal:</span><span class="value">${formatCurrency(breakdown.subtotal)}</span></div>
    ${breakdown.quantityDiscount > 0 ? `<div class="row"><span class="label">Quantity Discount:</span><span class="value">-${formatCurrency(breakdown.quantityDiscount)}</span></div>` : ''}
    <div class="row"><span class="label">Markup:</span><span class="value">${formatCurrency(breakdown.markup)}</span></div>
    <div class="row total-row"><span class="label">Estimated Total:</span><span class="value">${formatCurrency(breakdown.estimateLow)} - ${formatCurrency(breakdown.estimateHigh)}</span></div>
  </div>

  ${submission.notes ? `
  <div class="section">
    <h2>Customer Notes</h2>
    <div class="notes">${submission.notes}</div>
  </div>
  ` : ''}

  <div class="section">
    <a href="${downloadUrl}" class="btn">Download Model</a>
    <a href="${adminUrl}" class="btn btn-secondary">View in Dashboard</a>
  </div>

  <div class="footer">
    <p>This is an automated email from PrintForge. Submission ID: ${submission.id}</p>
  </div>
</body>
</html>
`.trim();

  await sendEmail({
    to: ownerEmail,
    subject: `New Quote Request: ${submission.fileName} - ${formatCurrency(breakdown.estimateLow)} - ${formatCurrency(breakdown.estimateHigh)}`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send confirmation email to customer
 */
export async function sendCustomerConfirmation(
  submission: QuoteSubmission,
  breakdown: PriceBreakdown,
  shopName: string
): Promise<void> {
  const textContent = `
Thank you for your 3D print quote request!

Hi ${submission.customerName},

We've received your quote request and are reviewing it. Here's a summary:

Print Details
────────────────
Material: ${submission.material}
Colour: ${submission.colour}
Quality: ${submission.quality}
Quantity: ${submission.quantity}
File: ${submission.fileName}

Estimated Price Range: ${formatCurrency(breakdown.estimateLow)} - ${formatCurrency(breakdown.estimateHigh)} AUD

We'll be in touch within 1-2 business days with a final quote.

If you have any questions, feel free to reply to this email.

Best regards,
${shopName}
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; }
    .section { background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .label { color: #666; }
    .value { font-weight: 500; }
    .estimate { font-size: 20px; font-weight: 600; color: #2563eb; text-align: center; margin: 24px 0; }
    .footer { margin-top: 32px; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Thank you for your quote request! 🖨️</h1>

  <p>Hi ${submission.customerName},</p>

  <p>We've received your 3D print quote request and are reviewing it. Here's a summary:</p>

  <div class="section">
    <div class="row"><span class="label">Material:</span><span class="value">${submission.material}</span></div>
    <div class="row"><span class="label">Colour:</span><span class="value">${submission.colour}</span></div>
    <div class="row"><span class="label">Quality:</span><span class="value">${submission.quality}</span></div>
    <div class="row"><span class="label">Quantity:</span><span class="value">${submission.quantity}</span></div>
    <div class="row"><span class="label">File:</span><span class="value">${submission.fileName}</span></div>
  </div>

  <div class="estimate">
    Estimated Price: ${formatCurrency(breakdown.estimateLow)} - ${formatCurrency(breakdown.estimateHigh)} AUD
  </div>

  <p>We'll be in touch within 1-2 business days with a final quote.</p>

  <p>If you have any questions, feel free to reply to this email.</p>

  <div class="footer">
    <p>Best regards,<br>${shopName}</p>
    <p style="font-size: 12px; color: #aaa;">Reference: ${submission.id}</p>
  </div>
</body>
</html>
`.trim();

  await sendEmail({
    to: submission.customerEmail,
    subject: `Your 3D Print Quote Request - ${shopName}`,
    text: textContent,
    html: htmlContent,
  });
}

/**
 * Send magic link for admin login
 */
export async function sendMagicLink(
  email: string,
  magicLinkUrl: string,
  shopName: string
): Promise<void> {
  const textContent = `
Sign in to ${shopName} Admin

Click the link below to sign in to your admin dashboard:

${magicLinkUrl}

This link will expire in 15 minutes.

If you didn't request this link, you can safely ignore this email.
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; margin: 24px 0; }
    .footer { margin-top: 32px; color: #888; font-size: 14px; }
    .warning { color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Sign in to ${shopName} Admin</h1>

  <p>Click the button below to sign in to your admin dashboard:</p>

  <a href="${magicLinkUrl}" class="btn">Sign In</a>

  <p class="warning">This link will expire in 15 minutes.</p>

  <div class="footer">
    <p>If you didn't request this link, you can safely ignore this email.</p>
  </div>
</body>
</html>
`.trim();

  await sendEmail({
    to: email,
    subject: `Sign in to ${shopName} Admin`,
    text: textContent,
    html: htmlContent,
  });
}
