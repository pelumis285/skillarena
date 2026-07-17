import type {
  AdminOverviewSnapshot,
  GameId,
  MatchRecord,
  PaymentRecord,
  PaymentRuntimeConfig,
  ResolvedBankAccount,
  SupportedBank,
  Tournament,
  User,
  UserProfileSnapshot,
  WalletTx,
} from './types';

export type BetaUserSummary = Pick<User, 'id' | 'username' | 'displayName' | 'avatar' | 'rating' | 'tier' | 'joinedAt' | 'role' | 'referralCode'> & {
  online: boolean;
};

type AuthPayload = {
  user: User;
  balance: number;
};

type EmailVerificationRequestPayload = {
  ok: true;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

type EmailVerificationConfirmPayload = {
  ok: true;
  verificationToken: string;
  expiresInSeconds: number;
};

type PasswordResetRequestPayload = {
  ok: true;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
};

type ProfileUpdatePayload = {
  ok: true;
  user: User;
  profile: UserProfileSnapshot;
};

type WalletPayload = {
  ok: true;
  balance: number;
  transactions: WalletTx[];
};

type PaymentActionPayload = WalletPayload & {
  payment: PaymentRecord;
};

type DepositInitializationPayload = {
  ok: true;
  payment: PaymentRecord;
  accessCode: string;
  authorizationUrl: string;
};

const REQUEST_TIMEOUT_MS = 20000;
const NETWORK_RETRY_DELAYS_MS = [1500, 3500];
const DEFAULT_LIVE_API_BASE = 'https://skillarena-beta-api.onrender.com';

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
  return DEFAULT_LIVE_API_BASE;
}

async function request<T>(path: string, init?: RequestInit) {
  const base = resolveApiBase();
  if (!base) {
    throw new Error('API is not configured for this build.');
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${base}${path}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
          },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || `Request failed: ${response.status}`);
        }
        return payload as T;
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === NETWORK_RETRY_DELAYS_MS.length) {
        break;
      }
      await warmApi(base);
      await wait(NETWORK_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw normalizeApiError(lastError);
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const message = error.message.toLowerCase();
  return (
    message.includes('load failed')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('timed out')
  );
}

function normalizeApiError(error: unknown) {
  if (error instanceof Error) {
    if (isTransientNetworkError(error)) {
      return new Error('Could not reach the live server. It may still be waking up. Please wait a few seconds and tap again.');
    }
    return error;
  }
  return new Error('Something went wrong while contacting the server.');
}

async function warmApi(base: string) {
  try {
    await fetch(`${base}/health`, { method: 'GET' });
  } catch {
    // Ignore warm-up failures and let the next retry decide.
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

class BetaApiClient {
  get endpoint() {
    return resolveApiBase();
  }

  get isConfigured() {
    return Boolean(this.endpoint);
  }

  async register(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    dateOfBirth: string;
    username: string;
    password: string;
    displayName: string;
    avatar: string;
    referralCode?: string;
    verificationToken: string;
  }) {
    return request<AuthPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async requestEmailCode(input: { email: string; firstName?: string }) {
    return request<EmailVerificationRequestPayload>('/api/auth/request-email-code', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async verifyEmailCode(input: { email: string; code: string }) {
    return request<EmailVerificationConfirmPayload>('/api/auth/verify-email-code', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: { identifier: string; password: string }) {
    return request<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async requestPasswordResetCode(input: { identifier: string }) {
    return request<PasswordResetRequestPayload>('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async resetPassword(input: { identifier: string; code: string; newPassword: string }) {
    return request<AuthPayload>('/api/auth/reset-password', {
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

  async getTransactions(userId: string) {
    const payload = await request<{ ok: true; transactions: WalletTx[] }>(`/api/wallet/${encodeURIComponent(userId)}/transactions`);
    return payload.transactions;
  }

  async getProfile(userId: string) {
    const payload = await request<{ ok: true; profile: UserProfileSnapshot }>(`/api/users/${encodeURIComponent(userId)}/profile`);
    return payload.profile;
  }

  async updatePhone(userId: string, phone: string) {
    return request<ProfileUpdatePayload>(`/api/users/${encodeURIComponent(userId)}/profile/phone`, {
      method: 'PATCH',
      body: JSON.stringify({ phone }),
    });
  }

  async updateProfile(userId: string, input: {
    displayName: string;
    country: string;
    phone: string;
    avatar: string;
    profileImage?: string | null;
  }) {
    return request<ProfileUpdatePayload>(`/api/users/${encodeURIComponent(userId)}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async updatePayoutDetails(userId: string, input: {
    bankCode?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    return request<ProfileUpdatePayload>(`/api/users/${encodeURIComponent(userId)}/profile/payout`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async getPaymentsConfig() {
    const payload = await request<{ ok: true; config: PaymentRuntimeConfig }>('/api/payments/config');
    return payload.config;
  }

  async listBanks() {
    const payload = await request<{ ok: true; banks: SupportedBank[] }>('/api/payments/banks');
    return payload.banks;
  }

  async resolveBankAccount(input: { bankCode: string; accountNumber: string }) {
    const query = new URLSearchParams({
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
    });
    const payload = await request<{ ok: true; account: ResolvedBankAccount }>(`/api/payments/banks/resolve?${query.toString()}`);
    return payload.account;
  }

  async initializeDeposit(input: { userId: string; amount: number }) {
    return request<DepositInitializationPayload>('/api/payments/deposit/initialize', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async verifyPayment(input: { userId: string; reference: string }) {
    return request<PaymentActionPayload>('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async syncPayments(userId: string) {
    const payload = await request<{ ok: true; balance: number; transactions: WalletTx[]; payments: PaymentRecord[] }>('/api/payments/sync', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return payload;
  }

  async requestWithdrawal(input: {
    userId: string;
    amount: number;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    return request<PaymentActionPayload>('/api/payments/withdrawals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async deposit(input: { userId: string; amount: number; description?: string }) {
    return request<WalletPayload>('/api/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async withdraw(input: { userId: string; amount: number; description?: string }) {
    return request<WalletPayload>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async recordMatch(input: {
    userId: string;
    game: GameId;
    result: MatchRecord['result'];
    score: string;
    stake: number;
    payout: number;
    opponentName?: string;
    opponentAvatar?: string;
    closingBalance?: number;
  }) {
    const payload = await request<{ ok: true; balance: number }>('/api/matches/record', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.balance;
  }

  async getAdminOverview(userId: string) {
    const payload = await request<{ ok: true; overview: AdminOverviewSnapshot }>(`/api/admin/overview?userId=${encodeURIComponent(userId)}`);
    return payload.overview;
  }

  async listTournaments(userId?: string) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const payload = await request<{ ok: true; tournaments: Tournament[] }>(`/api/tournaments${query}`);
    return payload.tournaments;
  }

  async createTournament(input: {
    title: string;
    game: GameId;
    stake: number;
    maxPlayers: number;
    allowSpectators?: boolean;
    creator: { id: string; name: string; avatar: string; rating: number };
  }) {
    const payload = await request<{ ok: true; tournament: Tournament }>('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.tournament;
  }

  async joinTournament(tournamentId: string, user: Pick<User, 'id' | 'displayName' | 'avatar' | 'rating'>) {
    const payload = await request<{ ok: true; tournament: Tournament }>(`/api/tournaments/${encodeURIComponent(tournamentId)}/join`, {
      method: 'POST',
      body: JSON.stringify({
        user: {
          id: user.id,
          name: user.displayName,
          avatar: user.avatar,
          rating: user.rating,
        },
      }),
    });
    return payload.tournament;
  }

  async reportTournamentWinner(tournamentId: string, matchId: string, winnerUserId: string, actingUserId: string) {
    const payload = await request<{ ok: true; tournament: Tournament }>(`/api/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/report`, {
      method: 'POST',
      body: JSON.stringify({
        winnerUserId,
        actingUserId,
      }),
    });
    return payload.tournament;
  }
}

export const betaApi = new BetaApiClient();
