import nodemailer from 'nodemailer';

type Attachment = { filename: string; content: Buffer; contentType: string };

export async function sendEmail({ to, subject, html, attachments }: { to: string[]; subject: string; html: string; attachments?: Attachment[] }) {
  // Check for SMTP configuration (Gmail) - trim to remove any whitespace/newlines
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = process.env.SMTP_PORT?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    // Use SMTP (Gmail or other)
    const port = parseInt(smtpPort);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: port,
      secure: port === 465, // true for 465, false for other ports (use STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      dnsTimeout: 30000,
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      // Add connection timeout
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });

    const mailOptions = {
      from: `"CKA Cash Ups" <${smtpUser}>`,
      to: to.join(', '),
      subject,
      html,
      attachments: (attachments || []).map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType
      }))
    };

    await transporter.sendMail(mailOptions);
    return;
  }

  // Fallback to Resend if configured
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== 're_123YourResendAPIKey') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CKA Cashups <onboarding@resend.dev>', // Use Resend's default sender for testing
        to,
        subject,
        html,
        attachments: (attachments || []).map(a => ({ filename: a.filename, content: a.content.toString('base64') }))
      })
    });
    if (!res.ok) throw new Error('Failed to send via Resend: ' + (await res.text()));
    return;
  }

  // No email provider configured
  throw new Error('No email provider configured. Set either SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) or RESEND_API_KEY');
}

