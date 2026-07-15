import { describe, test, expect, jest, beforeAll, afterAll } from '@jest/globals';
import supertest from 'supertest';

const mockSendPasswordResetEmail = jest.fn<() => Promise<boolean>>();
const mockIsEmailConfigured = jest.fn<() => boolean>();

jest.unstable_mockModule('../src/email.js', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  isEmailConfigured: mockIsEmailConfigured,
  verifyTransporter: jest.fn<() => Promise<boolean>>(),
  buildResetEmailHtmlPublic: jest.fn<(token: string) => string>(),
  buildResetEmailTextPublic: jest.fn<(token: string) => string>(),
}));

const { app } = await import('../src/index.js');
const request = supertest(app);

describe('POST /auth/forgot-password', () => {
  beforeAll(async () => {
    mockIsEmailConfigured.mockReturnValue(true);
    mockSendPasswordResetEmail.mockResolvedValue(true);
  });

  beforeEach(() => {
    mockSendPasswordResetEmail.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('returns success message when email is found', async () => {
    const username = `fp_user_${Date.now()}`;
    const emailAddr = `fp_${Date.now()}@example.com`;
    await request.post('/auth/register').send({ username, password: 'secret1234' }).expect(201);
    const { rows } = await (await import('../src/db.js'))
      .getDb()
      .query('UPDATE users SET email = $1 WHERE username = $2 RETURNING id', [emailAddr, username]);
    expect(rows.length).toBe(1);

    const res = await request.post('/auth/forgot-password').send({ email: emailAddr }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('recovery link');
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(emailAddr, expect.any(String));
  });

  test('returns success message even when email is not found', async () => {
    const res = await request.post('/auth/forgot-password').send({ email: 'nonexistent@example.com' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('returns success for anonymous accounts (no password_hash)', async () => {
    const emailAddr = `anon_${Date.now()}@example.com`;
    const anonRes = await request
      .post('/auth/register')
      .send({ username: `anon_${Date.now()}` })
      .expect(201);
    await (await import('../src/db.js'))
      .getDb()
      .query('UPDATE users SET email = $1 WHERE id = $2', [emailAddr, anonRes.body.playerId]);
    const res = await request.post('/auth/forgot-password').send({ email: emailAddr }).expect(200);
    expect(res.body.success).toBe(true);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('returns 503 when SMTP is not configured', async () => {
    mockIsEmailConfigured.mockReturnValue(false);
    const res = await request.post('/auth/forgot-password').send({ email: 'test@example.com' }).expect(503);
    expect(res.body.error).toContain('not configured');
  });

  test('returns 400 for invalid email', async () => {
    const res = await request.post('/auth/forgot-password').send({ email: 'not-an-email' }).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 for missing email', async () => {
    const res = await request.post('/auth/forgot-password').send({}).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 500 when email sending fails', async () => {
    mockIsEmailConfigured.mockReturnValue(true);
    mockSendPasswordResetEmail.mockResolvedValue(false);
    const emailAddr = `fail_${Date.now()}@example.com`;
    const regRes = await request
      .post('/auth/register')
      .send({ username: `fail_${Date.now()}`, password: 'secret1234' })
      .expect(201);
    await (await import('../src/db.js'))
      .getDb()
      .query('UPDATE users SET email = $1 WHERE id = $2', [emailAddr, regRes.body.playerId]);
    const res = await request.post('/auth/forgot-password').send({ email: emailAddr }).expect(500);
    expect(res.body.error).toContain('Failed to send');
  });
});

describe('POST /auth/reset-password', () => {
  let userId: string;
  let username: string;

  beforeAll(async () => {
    mockIsEmailConfigured.mockReturnValue(true);
    username = `rp_user_${Date.now()}`;
    const regRes = await request.post('/auth/register').send({ username, password: 'oldpass123' }).expect(201);
    userId = regRes.body.playerId;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  async function createResetToken(): Promise<string> {
    const { v4: uuidv4 } = await import('uuid');
    const token = uuidv4();
    const db = await import('../src/db.js');
    await db.createPasswordResetToken(token, userId, 3600000);
    return token;
  }

  test('resets password with valid token', async () => {
    const token = await createResetToken();
    const res = await request.post('/auth/reset-password').send({ token, newPassword: 'newpass123' }).expect(200);
    expect(res.body.success).toBe(true);

    /* Old password should not work */
    await request.post('/auth/login').send({ username, password: 'oldpass123' }).expect(401);

    /* New password should work */
    const login = await request.post('/auth/login').send({ username, password: 'newpass123' }).expect(200);
    expect(login.body.success).toBe(true);
  });

  test('rejects invalid token UUID', async () => {
    const res = await request
      .post('/auth/reset-password')
      .send({ token: 'not-a-uuid', newPassword: 'newpass123' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('rejects non-existent token', async () => {
    const res = await request
      .post('/auth/reset-password')
      .send({ token: '00000000-0000-0000-0000-000000000000', newPassword: 'newpass123' })
      .expect(400);
    expect(res.body.error).toContain('Invalid or expired');
  });

  test('rejects expired token', async () => {
    const db = await import('../src/db.js');
    const { v4: uuidv4 } = await import('uuid');
    const token = uuidv4();
    await db.createPasswordResetToken(token, userId, -60000);
    const res = await request.post('/auth/reset-password').send({ token, newPassword: 'newpass123' }).expect(400);
    expect(res.body.error).toContain('expired');
  });

  test('rejects already used token', async () => {
    const token = await createResetToken();
    await request.post('/auth/reset-password').send({ token, newPassword: 'newpass123' }).expect(200);
    const res = await request.post('/auth/reset-password').send({ token, newPassword: 'anotherpass' }).expect(400);
    expect(res.body.error).toContain('already been used');
  });

  test('rejects short new password', async () => {
    const token = await createResetToken();
    const res = await request.post('/auth/reset-password').send({ token, newPassword: 'ab' }).expect(400);
    expect(res.body).toHaveProperty('error');
  });

  test('rejects missing fields', async () => {
    await request.post('/auth/reset-password').send({}).expect(400);
    await request.post('/auth/reset-password').send({ token: '00000000-0000-0000-0000-000000000000' }).expect(400);
    await request.post('/auth/reset-password').send({ newPassword: 'newpass123' }).expect(400);
  });
});
