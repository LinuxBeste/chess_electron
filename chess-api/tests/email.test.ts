import { describe, test, expect, jest } from '@jest/globals';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail, verify: jest.fn() }));

jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

const email = await import('../src/email.js');

describe('isEmailConfigured', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns false when SMTP_HOST is not set', () => {
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    expect(email.isEmailConfigured()).toBe(false);
  });

  test('returns false when SMTP_USER is not set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PASS = 'pass';
    expect(email.isEmailConfigured()).toBe(false);
  });

  test('returns false when SMTP_PASS is not set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    expect(email.isEmailConfigured()).toBe(false);
  });

  test('returns true when all SMTP vars are set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    expect(email.isEmailConfigured()).toBe(true);
  });
});

describe('sendPasswordResetEmail', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns false when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const result = await email.sendPasswordResetEmail('test@example.com', 'some-token');
    expect(result).toBe(false);
  });

  test('returns true when email sent successfully', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    mockSendMail.mockResolvedValue(undefined);
    const result = await email.sendPasswordResetEmail('user@example.com', 'token-123');
    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0] as { to: string; subject: string; text: string; html: string };
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.subject).toContain('Reset your');
    expect(callArgs.html).toContain('token-123');
    expect(callArgs.html).toContain('reset-password');
    expect(callArgs.text).toContain('token-123');
  });

  test('returns false when sendMail throws', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    mockSendMail.mockRejectedValue(new Error('Connection refused'));
    const result = await email.sendPasswordResetEmail('user@example.com', 'token-123');
    expect(result).toBe(false);
  });
});

describe('buildResetEmailHtmlPublic', () => {
  test('returns HTML with reset link containing the token', () => {
    const html = email.buildResetEmailHtmlPublic('test-token-abc');
    expect(html).toContain('test-token-abc');
    expect(html).toContain('reset-password?token=');
    expect(html).toContain('Reset Password');
    expect(html).toContain('</html>');
  });

  test('includes app name and year in footer', () => {
    const html = email.buildResetEmailHtmlPublic('token');
    expect(html).toContain('Chess');
    expect(html).toContain(String(new Date().getFullYear()));
  });
});

describe('buildResetEmailTextPublic', () => {
  test('returns plain text with reset link', () => {
    const text = email.buildResetEmailTextPublic('token-xyz');
    expect(text).toContain('token-xyz');
    expect(text).toContain('/reset-password?token=');
    expect(text).toContain('Password Reset');
  });
});
