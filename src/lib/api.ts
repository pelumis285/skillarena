import type { User } from './types';

export type BetaUserSummary = Pick<User, 'id' | 'username' | 'displayName' | 'avatar' | 'rating' | 'tier' | 'joinedAt'> & {
  online: boolean;
};

type AuthPayload = {
  user: User;
  balance: number;
};

function resolveApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isBrowserHttp = protocol === 'http:' || protocol === 'https:';
    if (isBrowserHttp && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return `${protocol}//${hostname}:3001`;
    }
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit) {
  const base = resolveApiBase();
  if (!base) {
    throw new Error('API is not configured for this build.');
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }
  return payload as T;
}

class BetaApiClient {
  get endpoint() {
    return resolveApiBase();
  }

  get isConfigured() {
    return Boolean(this.endpoint);
  }

  async register(input: {
    email: string;
    username: string;
    password: string;
    displayName: string;
    avatar: string;
  }) {
    return request<AuthPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: { email: string; password: string }) {
    return request<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listUsers(excludeId?: string) {
    const query = excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : '';
    const payload = await request<{ ok: true; users: BetaUserSummary[] }>(`/api/users${query}`);
    return payload.users;
  }

  async getBalance(userId: string) {
    const payload = await request<{ ok: true; balance: number }>(`/api/wallet/${encodeURIComponent(userId)}`);
    return payload.balance;
  }

  async setBalance(userId: string, balance: number) {
    const payload = await request<{ ok: true; balance: number }>(`/api/users/${encodeURIComponent(userId)}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ balance }),
    });
    return payload.balance;
  }
}

export const betaApi = new BetaApiClient();
