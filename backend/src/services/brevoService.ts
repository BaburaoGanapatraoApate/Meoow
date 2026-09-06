import dotenv from "dotenv";

dotenv.config();

export interface SendOtpEmailParams {
  toEmail: string;
  toName: string;
  otp: string;
  purpose?: string;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendOtpEmail({
  toEmail,
  toName,
  otp,
  purpose = "email verification"
}: SendOtpEmailParams): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Meoow";

  if (!apiKey || !senderEmail) {
    const errorMsg = "BREVO_API_KEY or BREVO_SENDER_EMAIL is not configured in backend environment.";
    console.warn(`[BrevoService] Warning: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const subject = `Your Meoow Verification Code: ${otp}`;
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 24px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; text-align: center; }
    .title { font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #ffffff; text-align: center; }
    .description { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; text-align: center; }
    .otp-box { background: #0f172a; border: 2px dashed #38bdf8; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
    .expiry { font-size: 12px; color: #ef4444; margin-top: 8px; }
    .footer { font-size: 12px; color: #64748b; line-height: 1.5; text-align: center; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🐱 Meoow</div>
    <div class="title">Verify your email address</div>
    <div class="description">
      Hello ${toName || "there"},<br>
      Please enter the verification code below to complete your ${purpose} for your Meoow account.
    </div>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
      <div class="expiry">Expires in 10 minutes</div>
    </div>
    <div class="footer">
      If you did not request this verification code, you can safely ignore this email.<br>
      Never share your verification code with anyone.
    </div>
  </div>
</body>
</html>
  `;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail
        },
        to: [
          {
            email: toEmail,
            name: toName || toEmail
          }
        ],
        subject,
        htmlContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[BrevoService] Failed to send email to recipient: Status ${response.status}`,
        errorText
      );
      return {
        success: false,
        error: `Brevo API returned status ${response.status}: ${errorText}`
      };
    }

    const data: any = await response.json();
    console.log(`[BrevoService] OTP email successfully accepted by Brevo API. Message ID: ${data?.messageId || "OK"}`);
    return {
      success: true,
      messageId: data?.messageId
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error("[BrevoService] Unexpected network error while sending email:", errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }
}
