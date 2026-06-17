import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { mockChallenges } from '../src/lib/mock.ts';
import type { Challenge, User } from '../src/lib/types.ts';

export type StoredUser = User & {
  passwordHash: string;
  balance: number;
};

type BetaDatabase = {
  users: StoredUser[];
  challenges: Challenge[];
};

function resolveDatabasePath() {
  if (process.env.SKILLARENA_DB_PATH?.trim()) {
    return path.resolve(process.env.SKILLARENA_DB_PATH.trim());
  }
  return path.resolve(process.cwd(), 'server', 'data', 'beta-db.json');
}

const DB_PATH = resolveDatabasePath();
const DATA_DIR = path.dirname(DB_PATH);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function seedDatabase(): BetaDatabase {
  return {
    users: [],
    challenges: mockChallenges,
  };
}

export function loadDatabase(): BetaDatabase {
  ensureDataDir();

  if (!fs.existsSync(DB_PATH)) {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BetaDatabase>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : mockChallenges,
    };
  } catch {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

export function saveDatabase(database: BetaDatabase) {
  ensureDataDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
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
}): StoredUser {
  return {
    id: `u_${crypto.randomUUID().slice(0, 8)}`,
    email: input.email.trim().toLowerCase(),
    username: input.username.trim().toLowerCase(),
    displayName: input.displayName.trim() || input.username.trim(),
    avatar: input.avatar,
    rating: 1500,
    tier: 'Bronze',
    joinedAt: new Date().toISOString(),
    balance: 25,
    passwordHash: hashPassword(input.password),
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
  };
}
