import nodemailer from 'nodemailer';
import logger from './logger.js';

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  };
}
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@chess.example';
const APP_NAME = process.env.APP_NAME || 'Chess';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let transporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  const cfg = getSmtpConfig();
  return !!cfg.host && !!cfg.user && !!cfg.pass;
}

function createTransporter(): nodemailer.Transporter | null {
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    logger.warn('SMTP not configured — password reset emails will not be sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
    return null;
  }
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  logger.info('SMTP transporter created: host=' + cfg.host + ' port=' + cfg.port);
  return t;
}

function getTransporter(): nodemailer.Transporter | null {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

function buildResetEmailHtml(token: string): string {
  const resetLink = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <style>
    * { margin: 0; padding: 0; }
    body {
      background-color: #0a0a0c;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .card {
      background: linear-gradient(180deg, #151518 0%, #121214 100%);
      border-radius: 16px;
      border: 1px solid #252528;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 36px 32px 28px;
      text-align: center;
      border-bottom: 1px solid rgba(79, 142, 247, 0.15);
    }
    .logo {
      font-size: 36px;
      font-weight: 800;
      color: #f0f0f0;
      letter-spacing: -1px;
      line-height: 1.1;
    }
    .logo span { color: #4f8ef7; }
    .logo-icon { font-size: 28px; display: block; margin-bottom: 6px; }
    .body-content { padding: 32px; }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #e8e8e8;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    p {
      font-size: 14px;
      color: #9a9aa0;
      line-height: 1.7;
      margin-bottom: 20px;
    }
    .btn-wrapper { text-align: center; margin: 28px 0; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #4f8ef7 0%, #3b7ae0 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 36px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 14px rgba(79, 142, 247, 0.3);
      transition: box-shadow 0.2s;
    }
    .btn:hover { box-shadow: 0 6px 20px rgba(79, 142, 247, 0.45); }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #252528, transparent);
      margin: 24px 0;
    }
    .fallback-link {
      text-align: center;
      margin-bottom: 8px;
    }
    .fallback-link a {
      color: #5a5a62;
      font-size: 12px;
      word-break: break-all;
    }
    .footer {
      padding: 0 32px 28px;
      text-align: center;
    }
    .footer p {
      font-size: 11px;
      color: #4a4a50;
      margin-bottom: 4px;
      line-height: 1.5;
    }
    .footer a { color: #4f8ef7; text-decoration: none; }
    @media (max-width: 480px) {
      .wrapper { padding: 16px 12px; }
      .header { padding: 28px 20px 22px; }
      .body-content { padding: 24px 20px; }
      .footer { padding: 0 20px 24px; }
      .btn { display: block; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <span class="logo-icon">♚</span>
        <div class="logo"><span>${APP_NAME}</span></div>
      </div>

      <div class="body-content">
        <h1>Reset your password</h1>
        <p>We received a request to reset the password for your ${APP_NAME} account. Click the button below to choose a new one.</p>
        <p>This link is valid for <strong style="color:#bbb">1 hour</strong> — after that you'll need to request a new one.</p>

        <div class="btn-wrapper">
          <a class="btn" href="${resetLink}">Reset Password →</a>
        </div>

        <div class="divider"></div>

        <p style="font-size: 13px; color: #6a6a72;">
          If you didn't request this password reset, you can safely ignore this email.
          Your password will stay the same and your account remains secure.
        </p>

        <div class="fallback-link">
          <a href="${resetLink}">${resetLink}</a>
        </div>
      </div>

      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildResetEmailText(token: string): string {
  const resetLink = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return [
    `Password Reset for ${APP_NAME}`,
    '',
    'We received a request to reset the password for your ' + APP_NAME + ' account.',
    'Click the link below to choose a new one. This link is valid for 1 hour.',
    '',
    resetLink,
    '',
    "If you didn't request this password reset, you can safely ignore this email.",
    'Your password will stay the same and your account remains secure.',
    '',
    '© ' + new Date().getFullYear() + ' ' + APP_NAME + '. All rights reserved.',
  ].join('\n');
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.warn('SMTP not configured — would send reset email to ' + to + ' with token=' + token);
    return false;
  }
  try {
    await t.sendMail({
      from: SMTP_FROM,
      to,
      subject: 'Reset your ' + APP_NAME + ' password',
      text: buildResetEmailText(token),
      html: buildResetEmailHtml(token),
    });
    logger.info('Password reset email sent to ' + to);
    return true;
  } catch (err) {
    logger.error('Failed to send password reset email to ' + to + ': ' + err);
    return false;
  }
}

export function buildResetEmailHtmlPublic(token: string): string {
  return buildResetEmailHtml(token);
}

export function buildResetEmailTextPublic(token: string): string {
  return buildResetEmailText(token);
}

export async function verifyTransporter(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch {
    return false;
  }
}
