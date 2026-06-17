import { describe, test, expect, jest } from '@jest/globals';

class StoreStub {
  private data: Record<string, unknown> = { token: 'test-token' };
  get(key: string) {
    return this.data[key];
  }
  set(key: string, value: unknown) {
    this.data[key] = value;
  }
}

const store = new StoreStub();
let BASE_URL = 'http://localhost:3000';
function setBaseUrl(url: string): void {
  BASE_URL = url;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = store.get('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {}
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    err.name = 'ApiError';
    throw err;
  }
  return res.json() as Promise<T>;
}

describe('API client', () => {
  beforeEach(() => {
    setBaseUrl('http://localhost:3000');
  });

  test('setBaseUrl updates the base URL', () => {
    setBaseUrl('http://example.com:4000');
    expect(BASE_URL).toBe('http://example.com:4000');
  });

  test('register sends POST to /auth/register', async () => {
    const mockFetch = jest.fn((...args: unknown[]) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ playerId: 'p1', token: 't1' }),
      }),
    );
    global.fetch = mockFetch as never;
    const result = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'alice' }),
    });
    expect((result as Record<string, unknown>).playerId).toBe('p1');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('request includes auth header when token is present', async () => {
    const mockFetch = jest.fn((...args: unknown[]) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
    global.fetch = mockFetch as never;
    await request('/auth/me');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  test('request does not include auth when no token', async () => {
    store.set('token', null);
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
    global.fetch = mockFetch as never;
    await request('/games');
    const callArgs = (mockFetch.mock.calls[0] as Array<Record<string, unknown>>)[1];
    const headers = callArgs.headers as Record<string, unknown> | undefined;
    if (headers) {
      expect(headers.Authorization).toBeUndefined();
    }
    store.set('token', 'test-token');
  });

  test('non-ok response throws with error message', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Illegal move' }),
      }),
    ) as never;
    await expect(request('/games/fake', {})).rejects.toThrow('Illegal move');
  });

  test('non-ok response without body uses status message', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      }),
    ) as never;
    await expect(request('/games/fake', {})).rejects.toThrow('Request failed with status 500');
  });

  test('non-ok response sets error status', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      }),
    ) as never;
    try {
      await request('/games/fake', {});
    } catch (e: unknown) {
      expect((e as { status: number; name: string }).status).toBe(401);
      expect((e as { status: number; name: string }).name).toBe('ApiError');
    }
  });

  test('request uses custom base URL', async () => {
    setBaseUrl('https://server.com');
    const mockFetch = jest.fn((...args: unknown[]) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
    global.fetch = mockFetch as never;
    await request('/health');
    expect(mockFetch).toHaveBeenCalledWith('https://server.com/health', expect.any(Object));
  });

  test('request without method uses no method key (GET default)', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
    global.fetch = mockFetch as never;
    await request('/games');
    const callOptions = (mockFetch.mock.calls[0] as Array<Record<string, unknown>>)[1];
    /* No method property = browser defaults to GET */
    expect(callOptions.method).toBeUndefined();
  });

  test('request with POST method sends body', async () => {
    const mockFetch = jest.fn((...args: unknown[]) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'g1' }),
      }),
    );
    global.fetch = mockFetch as never;
    await request('/games', {
      method: 'POST',
      body: JSON.stringify({ visibility: 'private' }),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ visibility: 'private' }),
      }),
    );
  });

  test('response JSON is returned directly', async () => {
    const data = { status: 'ok', gamesActive: 5 };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data),
      }),
    ) as never;
    const result = await request('/health');
    expect(result).toEqual(data);
  });
});
