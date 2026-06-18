import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { mockChallenges } from '../src/lib/mock.ts';
import type {
  AdminOverviewSnapshot,
  AdminTrendPoint,
  AdminUserSnapshot,
  Challenge,
  MatchRecord,
  User,
  UserPerformancePoint,
  UserProfileSnapshot,
  UserProfileTotals,
  UserRole,
  WalletTx,
} from '../src/lib/types.ts';

export const REFERRAL_REWARD_AMOUNT = 2;
export const REFERRAL_REWARD_POINTS = 50;
const PLATFORM_FEE_RATE = 0.07;
const META_SCHEMA_VERSION = '1';

export type StoredWalletTransaction = WalletTx & {
  userId: string;
  balanceAfter: number;
};

export type StoredMatchRecord = MatchRecord & {
  userId: string;
  platformFee: number;
  net: number;
};

export type StoredReferralRecord = {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  code: string;
  rewardAmount: number;
  rewardPoints: number;
  createdAt: string;
};

export type StoredUser = User & {
  passwordHash: string;
  balance: number;
  role: UserRole;
  referralCode: string;
  referredByCode: string | null;
  referralPoints: number;
  referralEarnings: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWagered: number;
  totalPayouts: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
};

type BetaDatabase = {
  users: StoredUser[];
  challenges: Challenge[];
  walletTransactions: StoredWalletTransaction[];
  matchRecords: StoredMatchRecord[];
  referralRecords: StoredReferralRecord[];
};

type SqliteRow = Record<string, unknown>;

function resolveDatabasePath() {
  if (process.env.SKILLARENA_DB_PATH?.trim()) {
    return path.resolve(process.env.SKILLARENA_DB_PATH.trim());
  }
  return path.resolve(process.cwd(), 'server', 'data', 'skillarena.sqlite');
}

function resolveLegacyJsonPath() {
  return path.resolve(process.cwd(), 'server', 'data', 'beta-db.json');
}

function resolveAdminEmails() {
  return (process.env.SKILLARENA_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS = resolveAdminEmails();
const DB_PATH = resolveDatabasePath();
const LEGACY_JSON_PATH = resolveLegacyJsonPath();
const DATA_DIR = path.dirname(DB_PATH);
let sqlite: DatabaseSync | null = null;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function buildReferralCode(username: string, idSeed?: string) {
  const base = username.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'SKILL';
  const suffix = (idSeed ?? crypto.randomUUID().replace(/-/g, '')).slice(0, 4).toUpperCase();
  return `${base}${suffix}`;
}

function normalizeUserRole(email: string, existingRole?: string): UserRole {
  if (ADMIN_EMAILS.includes(email.trim().toLowerCase())) return 'admin';
  if (existingRole === 'admin' || existingRole === 'player') return existingRole;
  return 'player';
}

function normalizeStoredUser(user: Partial<StoredUser>, index: number): StoredUser {
  const username = (user.username ?? `player${index + 1}`).trim().toLowerCase();
  const email = (user.email ?? `${username}@cerebrum.test`).trim().toLowerCase();
  const joinedAt = user.joinedAt ?? new Date().toISOString();
  return {
    id: user.id ?? `u_${crypto.randomUUID().slice(0, 8)}`,
    email,
    username,
    displayName: user.displayName?.trim() || username,
    avatar: user.avatar ?? '🦊',
    rating: Number.isFinite(user.rating) ? Number(user.rating) : 1500,
    tier: user.tier ?? 'Bronze',
    joinedAt,
    role: normalizeUserRole(email, user.role),
    referralCode: user.referralCode?.trim() || buildReferralCode(username, user.id),
    referredByCode: user.referredByCode?.trim() || null,
    passwordHash: user.passwordHash ?? '',
    balance: Number.isFinite(user.balance) ? Number(user.balance) : 25,
    referralPoints: Number.isFinite(user.referralPoints) ? Number(user.referralPoints) : 0,
    referralEarnings: Number.isFinite(user.referralEarnings) ? Number(user.referralEarnings) : 0,
    totalDeposited: Number.isFinite(user.totalDeposited) ? Number(user.totalDeposited) : 0,
    totalWithdrawn: Number.isFinite(user.totalWithdrawn) ? Number(user.totalWithdrawn) : 0,
    totalWagered: Number.isFinite(user.totalWagered) ? Number(user.totalWagered) : 0,
    totalPayouts: Number.isFinite(user.totalPayouts) ? Number(user.totalPayouts) : 0,
    totalMatches: Number.isFinite(user.totalMatches) ? Number(user.totalMatches) : 0,
    totalWins: Number.isFinite(user.totalWins) ? Number(user.totalWins) : 0,
    totalLosses: Number.isFinite(user.totalLosses) ? Number(user.totalLosses) : 0,
    totalDraws: Number.isFinite(user.totalDraws) ? Number(user.totalDraws) : 0,
  };
}

function normalizeWalletTransaction(entry: Partial<StoredWalletTransaction>, index: number): StoredWalletTransaction {
  return {
    id: entry.id ?? `tx_${index}_${crypto.randomUUID().slice(0, 6)}`,
    userId: entry.userId ?? 'unknown',
    type: entry.type ?? 'adjustment',
    amount: Number.isFinite(entry.amount) ? Number(entry.amount) : 0,
    status: entry.status ?? 'completed',
    description: entry.description ?? 'Balance adjustment',
    game: entry.game,
    at: entry.at ?? new Date().toISOString(),
    balanceAfter: Number.isFinite(entry.balanceAfter) ? Number(entry.balanceAfter) : 0,
  };
}

function normalizeMatchRecord(entry: Partial<StoredMatchRecord>, index: number): StoredMatchRecord {
  const stake = Number.isFinite(entry.stake) ? Number(entry.stake) : 0;
  const payout = Number.isFinite(entry.payout) ? Number(entry.payout) : 0;
  const platformFee = Number.isFinite(entry.platformFee) ? Number(entry.platformFee) : Number((stake * PLATFORM_FEE_RATE).toFixed(2));
  return {
    id: entry.id ?? `match_${index}_${crypto.randomUUID().slice(0, 6)}`,
    userId: entry.userId ?? 'unknown',
    game: entry.game ?? 'chess',
    opponent: entry.opponent ?? { name: 'Arena rival', avatar: '🎯' },
    result: entry.result ?? 'loss',
    score: entry.score ?? '0-0',
    stake,
    payout,
    at: entry.at ?? new Date().toISOString(),
    platformFee,
    net: Number.isFinite(entry.net) ? Number(entry.net) : Number((payout - stake).toFixed(2)),
  };
}

function normalizeReferralRecord(entry: Partial<StoredReferralRecord>, index: number): StoredReferralRecord {
  return {
    id: entry.id ?? `ref_${index}_${crypto.randomUUID().slice(0, 6)}`,
    referrerUserId: entry.referrerUserId ?? 'unknown',
    referredUserId: entry.referredUserId ?? 'unknown',
    code: entry.code ?? '',
    rewardAmount: Number.isFinite(entry.rewardAmount) ? Number(entry.rewardAmount) : REFERRAL_REWARD_AMOUNT,
    rewardPoints: Number.isFinite(entry.rewardPoints) ? Number(entry.rewardPoints) : REFERRAL_REWARD_POINTS,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
}

function seedDatabase(): BetaDatabase {
  return {
    users: [],
    challenges: mockChallenges,
    walletTransactions: [],
    matchRecords: [],
    referralRecords: [],
  };
}

function ensureOneAdmin(users: StoredUser[]) {
  if (users.some((user) => user.role === 'admin')) return users;
  if (users[0]) users[0].role = 'admin';
  return users;
}

function ensureUniqueReferralCodes(users: StoredUser[]) {
  const seen = new Set<string>();
  for (const user of users) {
    let code = user.referralCode || buildReferralCode(user.username, user.id);
    while (seen.has(code)) {
      code = buildReferralCode(user.username);
    }
    user.referralCode = code;
    seen.add(code);
  }
  return users;
}

function getText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getNullableText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseChallengeRows(rows: SqliteRow[]) {
  const parsed: Challenge[] = [];
  for (const row of rows) {
    const payload = getText(row.payload);
    if (!payload) continue;
    try {
      parsed.push(JSON.parse(payload) as Challenge);
    } catch {
      continue;
    }
  }
  return parsed;
}

function readSnapshot(db: DatabaseSync): BetaDatabase {
  const userRows = db.prepare('SELECT * FROM users ORDER BY joined_at ASC').all() as SqliteRow[];
  const walletRows = db.prepare('SELECT * FROM wallet_transactions ORDER BY at DESC').all() as SqliteRow[];
  const matchRows = db.prepare('SELECT * FROM match_records ORDER BY at DESC').all() as SqliteRow[];
  const referralRows = db.prepare('SELECT * FROM referral_records ORDER BY created_at DESC').all() as SqliteRow[];
  const challengeRows = db.prepare('SELECT * FROM challenges ORDER BY row_order ASC').all() as SqliteRow[];

  const users = ensureUniqueReferralCodes(ensureOneAdmin(
    userRows.map((row, index) => normalizeStoredUser({
      id: getText(row.id),
      email: getText(row.email),
      username: getText(row.username),
      displayName: getText(row.display_name),
      avatar: getText(row.avatar),
      rating: getNumber(row.rating, 1500),
      tier: getText(row.tier) as StoredUser['tier'],
      joinedAt: getText(row.joined_at),
      role: getText(row.role) as UserRole,
      referralCode: getText(row.referral_code),
      referredByCode: getNullableText(row.referred_by_code),
      passwordHash: getText(row.password_hash),
      balance: getNumber(row.balance, 25),
      referralPoints: getNumber(row.referral_points),
      referralEarnings: getNumber(row.referral_earnings),
      totalDeposited: getNumber(row.total_deposited),
      totalWithdrawn: getNumber(row.total_withdrawn),
      totalWagered: getNumber(row.total_wagered),
      totalPayouts: getNumber(row.total_payouts),
      totalMatches: getNumber(row.total_matches),
      totalWins: getNumber(row.total_wins),
      totalLosses: getNumber(row.total_losses),
      totalDraws: getNumber(row.total_draws),
    }, index)),
  ));

  const challenges = parseChallengeRows(challengeRows);

  return {
    users,
    challenges: challenges.length ? challenges : mockChallenges,
    walletTransactions: walletRows.map((row, index) => normalizeWalletTransaction({
      id: getText(row.id),
      userId: getText(row.user_id),
      type: getText(row.type) as StoredWalletTransaction['type'],
      amount: getNumber(row.amount),
      status: getText(row.status) as StoredWalletTransaction['status'],
      description: getText(row.description),
      game: getNullableText(row.game) as StoredWalletTransaction['game'],
      at: getText(row.at),
      balanceAfter: getNumber(row.balance_after),
    }, index)),
    matchRecords: matchRows.map((row, index) => normalizeMatchRecord({
      id: getText(row.id),
      userId: getText(row.user_id),
      game: getText(row.game) as StoredMatchRecord['game'],
      opponent: {
        name: getText(row.opponent_name),
        avatar: getText(row.opponent_avatar),
      },
      result: getText(row.result) as StoredMatchRecord['result'],
      score: getText(row.score),
      stake: getNumber(row.stake),
      payout: getNumber(row.payout),
      at: getText(row.at),
      platformFee: getNumber(row.platform_fee),
      net: getNumber(row.net),
    }, index)),
    referralRecords: referralRows.map((row, index) => normalizeReferralRecord({
      id: getText(row.id),
      referrerUserId: getText(row.referrer_user_id),
      referredUserId: getText(row.referred_user_id),
      code: getText(row.code),
      rewardAmount: getNumber(row.reward_amount, REFERRAL_REWARD_AMOUNT),
      rewardPoints: getNumber(row.reward_points, REFERRAL_REWARD_POINTS),
      createdAt: getText(row.created_at),
    }, index)),
  };
}

function writeSnapshot(db: DatabaseSync, database: BetaDatabase) {
  const normalizedUsers = ensureUniqueReferralCodes(ensureOneAdmin(
    database.users.map((user, index) => normalizeStoredUser(user, index)),
  ));
  const normalizedChallenges = database.challenges.length ? database.challenges : mockChallenges;
  const normalizedWallet = database.walletTransactions.map((entry, index) => normalizeWalletTransaction(entry, index));
  const normalizedMatches = database.matchRecords.map((entry, index) => normalizeMatchRecord(entry, index));
  const normalizedReferrals = database.referralRecords.map((entry, index) => normalizeReferralRecord(entry, index));

  const upsertMeta = db.prepare(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, email, username, display_name, avatar, rating, tier, joined_at, role, referral_code,
      referred_by_code, password_hash, balance, referral_points, referral_earnings,
      total_deposited, total_withdrawn, total_wagered, total_payouts,
      total_matches, total_wins, total_losses, total_draws
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChallenge = db.prepare(`
    INSERT INTO challenges (id, row_order, payload)
    VALUES (?, ?, ?)
  `);
  const insertWallet = db.prepare(`
    INSERT INTO wallet_transactions (
      id, user_id, type, amount, status, description, game, at, balance_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMatch = db.prepare(`
    INSERT INTO match_records (
      id, user_id, game, opponent_name, opponent_avatar, result, score,
      stake, payout, at, platform_fee, net
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReferral = db.prepare(`
    INSERT INTO referral_records (
      id, referrer_user_id, referred_user_id, code, reward_amount, reward_points, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM referral_records');
    db.exec('DELETE FROM match_records');
    db.exec('DELETE FROM wallet_transactions');
    db.exec('DELETE FROM challenges');
    db.exec('DELETE FROM users');

    normalizedUsers.forEach((user) => {
      insertUser.run(
        user.id,
        user.email,
        user.username,
        user.displayName,
        user.avatar,
        user.rating,
        user.tier,
        user.joinedAt,
        user.role,
        user.referralCode,
        user.referredByCode,
        user.passwordHash,
        Number(user.balance.toFixed(2)),
        user.referralPoints,
        Number(user.referralEarnings.toFixed(2)),
        Number(user.totalDeposited.toFixed(2)),
        Number(user.totalWithdrawn.toFixed(2)),
        Number(user.totalWagered.toFixed(2)),
        Number(user.totalPayouts.toFixed(2)),
        user.totalMatches,
        user.totalWins,
        user.totalLosses,
        user.totalDraws,
      );
    });

    normalizedChallenges.forEach((challenge, index) => {
      insertChallenge.run(challenge.id, index, JSON.stringify(challenge));
    });

    normalizedWallet.forEach((entry) => {
      insertWallet.run(
        entry.id,
        entry.userId,
        entry.type,
        Number(entry.amount.toFixed(2)),
        entry.status,
        entry.description,
        entry.game ?? null,
        entry.at,
        Number(entry.balanceAfter.toFixed(2)),
      );
    });

    normalizedMatches.forEach((entry) => {
      insertMatch.run(
        entry.id,
        entry.userId,
        entry.game,
        entry.opponent.name,
        entry.opponent.avatar,
        entry.result,
        entry.score,
        Number(entry.stake.toFixed(2)),
        Number(entry.payout.toFixed(2)),
        entry.at,
        Number(entry.platformFee.toFixed(2)),
        Number(entry.net.toFixed(2)),
      );
    });

    normalizedReferrals.forEach((entry) => {
      insertReferral.run(
        entry.id,
        entry.referrerUserId,
        entry.referredUserId,
        entry.code,
        Number(entry.rewardAmount.toFixed(2)),
        entry.rewardPoints,
        entry.createdAt,
      );
    });

    upsertMeta.run('schema_version', META_SCHEMA_VERSION);
    upsertMeta.run('engine', 'sqlite');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      rating REAL NOT NULL,
      tier TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      role TEXT NOT NULL,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by_code TEXT,
      password_hash TEXT NOT NULL,
      balance REAL NOT NULL,
      referral_points INTEGER NOT NULL,
      referral_earnings REAL NOT NULL,
      total_deposited REAL NOT NULL,
      total_withdrawn REAL NOT NULL,
      total_wagered REAL NOT NULL,
      total_payouts REAL NOT NULL,
      total_matches INTEGER NOT NULL,
      total_wins INTEGER NOT NULL,
      total_losses INTEGER NOT NULL,
      total_draws INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      row_order INTEGER NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      game TEXT,
      at TEXT NOT NULL,
      balance_after REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      game TEXT NOT NULL,
      opponent_name TEXT NOT NULL,
      opponent_avatar TEXT NOT NULL,
      result TEXT NOT NULL,
      score TEXT NOT NULL,
      stake REAL NOT NULL,
      payout REAL NOT NULL,
      at TEXT NOT NULL,
      platform_fee REAL NOT NULL,
      net REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referral_records (
      id TEXT PRIMARY KEY,
      referrer_user_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      reward_amount REAL NOT NULL,
      reward_points INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function importLegacyJsonIfNeeded(db: DatabaseSync) {
  const metaValue = db.prepare('SELECT value FROM meta WHERE key = ?').get('legacy_json_migrated') as SqliteRow | undefined;
  if (getText(metaValue?.value) === '1') return;

  const counts = {
    users: getNumber((db.prepare('SELECT COUNT(*) AS count FROM users').get() as SqliteRow | undefined)?.count),
    challenges: getNumber((db.prepare('SELECT COUNT(*) AS count FROM challenges').get() as SqliteRow | undefined)?.count),
    wallet: getNumber((db.prepare('SELECT COUNT(*) AS count FROM wallet_transactions').get() as SqliteRow | undefined)?.count),
    matches: getNumber((db.prepare('SELECT COUNT(*) AS count FROM match_records').get() as SqliteRow | undefined)?.count),
    referrals: getNumber((db.prepare('SELECT COUNT(*) AS count FROM referral_records').get() as SqliteRow | undefined)?.count),
  };
  const hasExistingData = Object.values(counts).some((count) => count > 0);
  if (hasExistingData) {
    db.prepare(`
      INSERT INTO meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run('legacy_json_migrated', '1');
    return;
  }

  if (fs.existsSync(LEGACY_JSON_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, 'utf8')) as Partial<BetaDatabase>;
      writeSnapshot(db, {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        challenges: Array.isArray(parsed.challenges) ? parsed.challenges : mockChallenges,
        walletTransactions: Array.isArray(parsed.walletTransactions) ? parsed.walletTransactions : [],
        matchRecords: Array.isArray(parsed.matchRecords) ? parsed.matchRecords : [],
        referralRecords: Array.isArray(parsed.referralRecords) ? parsed.referralRecords : [],
      });
      db.prepare(`
        INSERT INTO meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run('legacy_json_migrated', '1');
      return;
    } catch {
      // Fall through to fresh seed if the legacy file is unreadable.
    }
  }

  writeSnapshot(db, seedDatabase());
  db.prepare(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run('legacy_json_migrated', '1');
}

function getDatabase() {
  if (sqlite) return sqlite;

  ensureDataDir();
  sqlite = new DatabaseSync(DB_PATH);
  migrateSchema(sqlite);
  importLegacyJsonIfNeeded(sqlite);
  return sqlite;
}

export function loadDatabase(): BetaDatabase {
  const db = getDatabase();
  const snapshot = readSnapshot(db);
  saveDatabase(snapshot);
  return snapshot;
}

export function saveDatabase(database: BetaDatabase) {
  const db = getDatabase();
  writeSnapshot(db, database);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, expectedHash] = passwordHash.split(':');
  if (!salt || !expectedHash) return false;
  const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const left = Buffer.from(derivedHash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createStoredUser(input: {
  email: string;
  username: string;
  password: string;
  displayName: string;
  avatar: string;
  referredByCode?: string | null;
  role?: UserRole;
}): StoredUser {
  const id = `u_${crypto.randomUUID().slice(0, 8)}`;
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  return {
    id,
    email,
    username,
    displayName: input.displayName.trim() || input.username.trim(),
    avatar: input.avatar,
    rating: 1500,
    tier: 'Bronze',
    joinedAt: new Date().toISOString(),
    role: input.role ?? normalizeUserRole(email),
    referralCode: buildReferralCode(username, id),
    referredByCode: input.referredByCode?.trim().toUpperCase() || null,
    balance: 25,
    passwordHash: hashPassword(input.password),
    referralPoints: 0,
    referralEarnings: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalWagered: 0,
    totalPayouts: 0,
    totalMatches: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
  };
}

export function toPublicUser(user: StoredUser): User {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    rating: user.rating,
    tier: user.tier,
    joinedAt: user.joinedAt,
    role: user.role,
    referralCode: user.referralCode,
    referredByCode: user.referredByCode,
  };
}

export function createStoredWalletTransaction(input: {
  userId: string;
  balanceAfter: number;
  type: StoredWalletTransaction['type'];
  amount: number;
  status?: StoredWalletTransaction['status'];
  description: string;
  game?: StoredWalletTransaction['game'];
  at?: string;
}): StoredWalletTransaction {
  return {
    id: `tx_${crypto.randomUUID().slice(0, 10)}`,
    userId: input.userId,
    balanceAfter: Number(input.balanceAfter.toFixed(2)),
    type: input.type,
    amount: Number(input.amount.toFixed(2)),
    status: input.status ?? 'completed',
    description: input.description,
    game: input.game,
    at: input.at ?? new Date().toISOString(),
  };
}

export function createStoredMatchRecord(input: {
  userId: string;
  game: MatchRecord['game'];
  opponent: MatchRecord['opponent'];
  result: MatchRecord['result'];
  score: string;
  stake: number;
  payout: number;
  at?: string;
}): StoredMatchRecord {
  const stake = Number(input.stake.toFixed(2));
  const payout = Number(input.payout.toFixed(2));
  const platformFee = Number((stake * PLATFORM_FEE_RATE).toFixed(2));
  return {
    id: `match_${crypto.randomUUID().slice(0, 10)}`,
    userId: input.userId,
    game: input.game,
    opponent: input.opponent,
    result: input.result,
    score: input.score,
    stake,
    payout,
    at: input.at ?? new Date().toISOString(),
    platformFee,
    net: Number((payout - stake).toFixed(2)),
  };
}

export function createReferralRecord(input: {
  referrerUserId: string;
  referredUserId: string;
  code: string;
  rewardAmount?: number;
  rewardPoints?: number;
}): StoredReferralRecord {
  return {
    id: `ref_${crypto.randomUUID().slice(0, 10)}`,
    referrerUserId: input.referrerUserId,
    referredUserId: input.referredUserId,
    code: input.code,
    rewardAmount: input.rewardAmount ?? REFERRAL_REWARD_AMOUNT,
    rewardPoints: input.rewardPoints ?? REFERRAL_REWARD_POINTS,
    createdAt: new Date().toISOString(),
  };
}

export function buildUserProfileSnapshot(params: {
  user: StoredUser;
  walletTransactions: StoredWalletTransaction[];
  matchRecords: StoredMatchRecord[];
  referralRecords: StoredReferralRecord[];
  usersById: Map<string, StoredUser>;
}): UserProfileSnapshot {
  const { user, walletTransactions, matchRecords, referralRecords, usersById } = params;
  const userTransactions = walletTransactions
    .filter((entry) => entry.userId === user.id)
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  const userMatches = matchRecords
    .filter((entry) => entry.userId === user.id)
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  const userReferrals = referralRecords.filter((entry) => entry.referrerUserId === user.id);
  const totals: UserProfileTotals = {
    deposited: Number(user.totalDeposited.toFixed(2)),
    withdrawn: Number(user.totalWithdrawn.toFixed(2)),
    wagered: Number(user.totalWagered.toFixed(2)),
    earned: Number(user.totalPayouts.toFixed(2)),
    net: Number((user.totalPayouts - user.totalWagered + user.referralEarnings).toFixed(2)),
    matchesPlayed: user.totalMatches,
    wins: user.totalWins,
    losses: user.totalLosses,
    draws: user.totalDraws,
    referrals: userReferrals.length,
    referralPoints: user.referralPoints,
    referralEarnings: Number(user.referralEarnings.toFixed(2)),
  };

  const performanceMap = new Map<string, UserPerformancePoint>();
  for (const match of userMatches.slice(0, 12).reverse()) {
    const date = new Date(match.at);
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const current = performanceMap.get(label) ?? { label, wins: 0, losses: 0, draws: 0, net: 0 };
    if (match.result === 'win') current.wins += 1;
    else if (match.result === 'loss') current.losses += 1;
    else current.draws += 1;
    current.net = Number((current.net + match.net).toFixed(2));
    performanceMap.set(label, current);
  }

  return {
    user: toPublicUser(user),
    balance: Number(user.balance.toFixed(2)),
    totals,
    transactions: userTransactions.slice(0, 8).map(({ userId: _userId, balanceAfter: _balanceAfter, ...tx }) => tx),
    matches: userMatches.slice(0, 8).map(({ userId: _userId, platformFee: _platformFee, net: _net, ...match }) => match),
    performance: [...performanceMap.values()],
    referral: {
      code: user.referralCode,
      referredByCode: user.referredByCode,
      rewardPerFriend: REFERRAL_REWARD_AMOUNT,
      pointsPerFriend: REFERRAL_REWARD_POINTS,
      friends: userReferrals.map((entry) => {
        const referredUser = usersById.get(entry.referredUserId);
        return {
          id: entry.referredUserId,
          username: referredUser?.username ?? 'friend',
          displayName: referredUser?.displayName ?? 'Invited friend',
          joinedAt: referredUser?.joinedAt ?? entry.createdAt,
          rewardAmount: entry.rewardAmount,
          rewardPoints: entry.rewardPoints,
        };
      }),
    },
  };
}

export function buildAdminOverviewSnapshot(params: {
  users: StoredUser[];
  walletTransactions: StoredWalletTransaction[];
  matchRecords: StoredMatchRecord[];
  referralRecords: StoredReferralRecord[];
  onlineUserIds?: Set<string>;
}): AdminOverviewSnapshot {
  const { users, walletTransactions, matchRecords, referralRecords, onlineUserIds } = params;
  const referralCounts = new Map<string, number>();
  for (const record of referralRecords) {
    referralCounts.set(record.referrerUserId, (referralCounts.get(record.referrerUserId) ?? 0) + 1);
  }

  const totals = {
    users: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
    activeUsers: onlineUserIds?.size ?? 0,
    fundedUsers: users.filter((user) => user.totalDeposited > 0).length,
    referredUsers: users.filter((user) => user.referredByCode).length,
    totalBalances: Number(users.reduce((sum, user) => sum + user.balance, 0).toFixed(2)),
    totalDeposited: Number(users.reduce((sum, user) => sum + user.totalDeposited, 0).toFixed(2)),
    totalWithdrawn: Number(users.reduce((sum, user) => sum + user.totalWithdrawn, 0).toFixed(2)),
    totalWagered: Number(users.reduce((sum, user) => sum + user.totalWagered, 0).toFixed(2)),
    totalPayouts: Number(users.reduce((sum, user) => sum + user.totalPayouts, 0).toFixed(2)),
    totalReferralRewards: Number(users.reduce((sum, user) => sum + user.referralEarnings, 0).toFixed(2)),
    totalReferralPoints: users.reduce((sum, user) => sum + user.referralPoints, 0),
    platformRevenue: Number(matchRecords.reduce((sum, match) => sum + match.platformFee, 0).toFixed(2)),
  };

  const userRows: AdminUserSnapshot[] = users
    .map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      joinedAt: user.joinedAt,
      balance: Number(user.balance.toFixed(2)),
      role: user.role,
      deposited: Number(user.totalDeposited.toFixed(2)),
      withdrawn: Number(user.totalWithdrawn.toFixed(2)),
      wagered: Number(user.totalWagered.toFixed(2)),
      earned: Number(user.totalPayouts.toFixed(2)),
      wins: user.totalWins,
      losses: user.totalLosses,
      referralCount: referralCounts.get(user.id) ?? 0,
      referralPoints: user.referralPoints,
      referralEarnings: Number(user.referralEarnings.toFixed(2)),
    }))
    .sort((left, right) => right.deposited + right.earned - (left.deposited + left.earned));

  const trendMap = new Map<string, AdminTrendPoint>();
  const sortedTx = [...walletTransactions].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  for (const tx of sortedTx) {
    const label = new Date(tx.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const point = trendMap.get(label) ?? { label, deposits: 0, withdrawals: 0, platformRevenue: 0, wins: 0, losses: 0 };
    if (tx.type === 'deposit' || tx.type === 'referral_bonus') point.deposits = Number((point.deposits + Math.max(tx.amount, 0)).toFixed(2));
    if (tx.type === 'withdrawal') point.withdrawals = Number((point.withdrawals + Math.abs(tx.amount)).toFixed(2));
    trendMap.set(label, point);
  }
  for (const match of matchRecords) {
    const label = new Date(match.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const point = trendMap.get(label) ?? { label, deposits: 0, withdrawals: 0, platformRevenue: 0, wins: 0, losses: 0 };
    point.platformRevenue = Number((point.platformRevenue + match.platformFee).toFixed(2));
    if (match.result === 'win') point.wins += 1;
    if (match.result === 'loss') point.losses += 1;
    trendMap.set(label, point);
  }

  const usersById = new Map(users.map((user) => [user.id, user]));

  return {
    totals,
    trends: [...trendMap.values()].slice(-10),
    recentTransactions: [...walletTransactions]
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, 10)
      .map(({ balanceAfter: _balanceAfter, ...entry }) => ({
        ...entry,
        username: usersById.get(entry.userId)?.username ?? 'unknown',
        displayName: usersById.get(entry.userId)?.displayName ?? 'Unknown user',
      })),
    topPlayers: [...userRows].sort((left, right) => right.wins - left.wins || right.earned - left.earned).slice(0, 6),
    topReferrers: [...userRows].sort((left, right) => right.referralCount - left.referralCount || right.referralEarnings - left.referralEarnings).slice(0, 6),
    users: userRows,
  };
}
