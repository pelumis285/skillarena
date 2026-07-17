import './loadEnv.ts';
import crypto from 'node:crypto';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import nodemailer from 'nodemailer';
import { Server } from 'socket.io';
import { createLudoMatchState, moveLudoMatch, rollLudoMatch } from '../src/lib/ludoEngine.ts';
import { mockChallenges, mockTournaments } from '../src/lib/mock.ts';
import type {
  Challenge,
  ChallengeParticipant,
  ChallengeRoomState,
  GameId,
  LudoMatchState,
  LudoSeats,
  MatchRecord,
  PaymentRecord,
  PaymentRuntimeConfig,
  PaymentStatus,
  ResolvedBankAccount,
  RoomChatMessage,
  SupportedBank,
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  TournamentRound,
  UserRole,
} from '../src/lib/types.ts';
import {
  REFERRAL_REWARD_AMOUNT,
  REFERRAL_REWARD_POINTS,
  buildAdminOverviewSnapshot,
  buildUserProfileSnapshot,
  createReferralRecord,
  createStoredMatchRecord,
  createStoredPaymentRecord,
  createStoredUser,
  createStoredWalletTransaction,
  hashPassword,
  loadDatabase,
  saveDatabase,
  toPublicUser,
  verifyPassword,
  type StoredMatchRecord,
  type StoredPaymentRecord,
  type StoredReferralRecord,
  type StoredUser,
  type StoredWalletTransaction,
} from './store.ts';

type PlayerIdentity = {
  id: string;
  name: string;
  avatar: string;
  rating?: number;
};

type CreateChallengePayload = Omit<Challenge, 'createdAt' | 'status' | 'participants' | 'seatsFilled' | 'roomId'> & {
  creator: { id: string; name: string; avatar: string; rating: number };
};

type AcceptChallengePayload = {
  challengeId: string;
  user: PlayerIdentity;
};

type JoinRoomPayload = {
  roomId: string;
  user: PlayerIdentity;
};

type ReadyPayload = {
  roomId: string;
  userId: string;
  ready: boolean;
};

type StartLudoPayload = {
  roomId: string;
  userId: string;
  stake?: number;
};

type LudoRollPayload = {
  roomId: string;
  userId: string;
};

type LudoMovePayload = {
  roomId: string;
  userId: string;
  laneId: string;
  tokenId: number;
};

type RoomScopedPayload = {
  roomId: string;
};

type ChatSendPayload = RoomScopedPayload & {
  text?: string;
};

type RoomSupportPayload = RoomScopedPayload & {
  userId: string;
  targetUserId?: string | null;
};

type RegisterPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  dateOfBirth?: string;
  username?: string;
  password?: string;
  displayName?: string;
  avatar?: string;
  referralCode?: string;
  verificationToken?: string;
};

type LoginPayload = {
  identifier?: string;
  email?: string;
  password?: string;
};

type RequestEmailCodePayload = {
  email?: string;
  firstName?: string;
};

type VerifyEmailCodePayload = {
  email?: string;
  code?: string;
};

type RequestPasswordResetPayload = {
  identifier?: string;
};

type ResetPasswordPayload = {
  identifier?: string;
  code?: string;
  newPassword?: string;
};

type UpdatePhonePayload = {
  phone?: string;
};

type UpdateProfilePayload = {
  displayName?: string;
  country?: string;
  phone?: string;
  avatar?: string;
  profileImage?: string | null;
};

type UpdatePayoutDetailsPayload = {
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

type WalletActionPayload = {
  userId?: string;
  amount?: number;
  description?: string;
};

type PaymentVerifyPayload = {
  userId?: string;
  reference?: string;
};

type WithdrawalRequestPayload = {
  userId?: string;
  amount?: number;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

type RecordMatchPayload = {
  userId?: string;
  game?: GameId;
  result?: MatchRecord['result'];
  score?: string;
  stake?: number;
  payout?: number;
  opponentName?: string;
  opponentAvatar?: string;
  closingBalance?: number;
};

type CreateTournamentPayload = {
  title?: string;
  game?: GameId;
  stake?: number;
  maxPlayers?: number;
  allowSpectators?: boolean;
  creator?: PlayerIdentity;
};

type JoinTournamentPayload = {
  user?: PlayerIdentity;
};

type ReportTournamentWinnerPayload = {
  winnerUserId?: string;
  actingUserId?: string;
};

function resolveAllowedOrigins() {
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://127.0.0.1',
  ];
  const configured = process.env.ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length ? [...new Set([...defaults, ...configured])] : defaults;
}

const allowedOrigins = resolveAllowedOrigins();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const VERIFICATION_CODE_PATTERN = /^\d{6}$/;
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_EMAIL_TTL_MS = 30 * 60 * 1000;
const VERIFICATION_RESEND_WINDOW_MS = 45 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_RESEND_WINDOW_MS = 45 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

type EmailVerificationSession = {
  email: string;
  firstName: string;
  codeHash: string;
  requestedAt: number;
  expiresAt: number;
  attempts: number;
  verifiedAt: number | null;
  verificationToken: string | null;
};

type PasswordResetSession = {
  identifier: string;
  email: string;
  userId: string;
  firstName: string;
  codeHash: string;
  requestedAt: number;
  expiresAt: number;
  attempts: number;
};

const emailVerificationStore = new Map<string, EmailVerificationSession>();
const passwordResetStore = new Map<string, PasswordResetSession>();
let smtpTransport: nodemailer.Transporter | null = null;

function isEmailVerificationConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim()
    && process.env.SMTP_PORT?.trim()
    && process.env.SMTP_FROM?.trim()
    && process.env.SMTP_USER?.trim()
    && process.env.SMTP_PASS?.trim(),
  );
}

function resolveSmtpTransport() {
  if (smtpTransport) return smtpTransport;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim() ?? '');
  const from = process.env.SMTP_FROM?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !from || !user || !pass || !Number.isFinite(port) || port <= 0) {
    return null;
  }

  const secure = process.env.SMTP_SECURE?.trim()
    ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true'
    : port === 465;

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return smtpTransport;
}

function hashVerificationCode(email: string, code: string) {
  const secret = process.env.EMAIL_VERIFICATION_SECRET?.trim() || 'cerebrum-email-verification';
  return crypto.createHash('sha256').update(`${email}:${code}:${secret}`).digest('hex');
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function createVerificationToken() {
  return crypto.randomUUID();
}

function cleanupExpiredEmailVerification(email: string) {
  const session = emailVerificationStore.get(email);
  if (!session) return null;
  if (session.expiresAt > Date.now()) return session;
  emailVerificationStore.delete(email);
  return null;
}

function cleanupExpiredPasswordReset(identifier: string) {
  const session = passwordResetStore.get(identifier);
  if (!session) return null;
  if (session.expiresAt > Date.now()) return session;
  passwordResetStore.delete(identifier);
  return null;
}

async function sendEmailVerificationCode(params: { email: string; firstName: string; code: string }) {
  const transport = resolveSmtpTransport();
  const from = process.env.SMTP_FROM?.trim();

  if (!transport || !from) {
    throw new Error('Email verification is not configured on the server yet.');
  }

  const greetingName = params.firstName || 'Player';
  const expiresInMinutes = Math.round(VERIFICATION_CODE_TTL_MS / 60000);

  await transport.sendMail({
    from,
    to: params.email,
    subject: 'Your Cerebrum verification code',
    text: [
      `Hi ${greetingName},`,
      '',
      `Your Cerebrum verification code is ${params.code}.`,
      `It expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this code, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b1020;color:#f3f6fb;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#11182b;border-radius:20px;padding:24px;border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:12px;letter-spacing:0.22em;color:#b8fa33;font-weight:700;">CEREBRUM</div>
          <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.1;">Verify your email</h1>
          <p style="margin:0 0 20px;color:#b9c2d5;line-height:1.6;">Hi ${greetingName}, use this 6-digit code to finish creating your player account.</p>
          <div style="margin:20px 0;padding:18px 20px;border-radius:16px;background:#1b2438;font-size:32px;font-weight:800;letter-spacing:0.32em;text-align:center;">${params.code}</div>
          <p style="margin:0;color:#b9c2d5;line-height:1.6;">This code expires in ${expiresInMinutes} minutes.</p>
        </div>
      </div>
    `,
  });
}

async function sendPasswordResetCode(params: { email: string; firstName: string; code: string }) {
  const transport = resolveSmtpTransport();
  const from = process.env.SMTP_FROM?.trim();

  if (!transport || !from) {
    throw new Error('Password recovery email is not configured on the server yet.');
  }

  const greetingName = params.firstName || 'Player';
  const expiresInMinutes = Math.round(PASSWORD_RESET_TTL_MS / 60000);

  await transport.sendMail({
    from,
    to: params.email,
    subject: 'Reset your Cerebrum password',
    text: [
      `Hi ${greetingName},`,
      '',
      `Your Cerebrum password reset code is ${params.code}.`,
      `It expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this code, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b1020;color:#f3f6fb;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#11182b;border-radius:20px;padding:24px;border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:12px;letter-spacing:0.22em;color:#b8fa33;font-weight:700;">CEREBRUM</div>
          <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.1;">Reset your password</h1>
          <p style="margin:0 0 20px;color:#b9c2d5;line-height:1.6;">Hi ${greetingName}, use this 6-digit code to choose a new password for your player account.</p>
          <div style="margin:20px 0;padding:18px 20px;border-radius:16px;background:#1b2438;font-size:32px;font-weight:800;letter-spacing:0.32em;text-align:center;">${params.code}</div>
          <p style="margin:0;color:#b9c2d5;line-height:1.6;">This code expires in ${expiresInMinutes} minutes.</p>
        </div>
      </div>
    `,
  });
}

function isAllowedOrigin(origin?: string | null) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    if ((parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:') && parsed.hostname === 'localhost') {
      return true;
    }
  } catch {
    // Fall through to exact-match lookup below.
  }
  return allowedOrigins.includes(origin);
}

function sanitizeHumanName(value?: string) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function sanitizePhone(value?: string) {
  return value?.trim().replace(/[^\d+\-\s().]/g, '') ?? '';
}

function isValidDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getAgeFromDateOfBirth(value: string) {
  if (!isValidDateOfBirth(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - parsed.getUTCMonth();
  const dayDelta = today.getUTCDate() - parsed.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age;
}

function participantFromUser(user: PlayerIdentity, seatIndex: number): ChallengeParticipant {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    rating: user.rating,
    seatIndex,
    ready: false,
  };
}

function defaultRoomId(challengeId: string) {
  return `room-${challengeId}`;
}

function tournamentSeatsForGame(game: GameId) {
  return game === 'ludo' ? 4 : 2;
}

function challengeSeats(challenge: Challenge): LudoSeats {
  return challenge.game === 'ludo' ? (challenge.seats ?? 2) : 2;
}

function roomStateFromChallenge(challenge: Challenge): ChallengeRoomState | null {
  if (!challenge.roomId) return null;
  const derivedState = challenge.status === 'finished'
    ? 'finished'
    : challenge.status === 'in_progress'
      ? 'in_progress'
      : (challenge.participants?.length ?? 0) >= challengeSeats(challenge)
        ? 'ready'
        : 'waiting';
  return {
    roomId: challenge.roomId,
    challengeId: challenge.id,
    game: challenge.game,
    seats: challengeSeats(challenge),
    participants: challenge.participants ?? [],
    hostUserId: challenge.creator.id,
    inviteCode: challenge.inviteCode,
    state: derivedState,
    spectators: [],
  };
}

function isVisibleToUser(challenge: Challenge, userId?: string) {
  if (challenge.inviteScope !== 'private') return true;
  if (!userId) return false;
  const invitedIds = challenge.invitedUsers?.map((invite) => invite.id).filter(Boolean) ?? [];
  return challenge.creator.id === userId || challenge.invitedUserId === userId || invitedIds.includes(userId) || challenge.participants?.some((participant) => participant.id === userId);
}

function canAccessChallengeRoom(challenge: Challenge, userId?: string) {
  if (!userId) return false;
  if (challenge.creator.id === userId) return true;
  if (challenge.invitedUserId === userId) return true;
  const invitedIds = challenge.invitedUsers?.map((invite) => invite.id).filter(Boolean) ?? [];
  if (invitedIds.includes(userId)) return true;
  if (challenge.participants?.some((participant) => participant.id === userId)) return true;
  return challenge.inviteScope !== 'private' && challenge.game === 'ludo';
}

function buildSeedChallenges(source: Challenge[]) {
  return source.map((challenge) => {
    const normalized: Challenge = {
      ...challenge,
      roomId: challenge.roomId ?? defaultRoomId(challenge.id),
      seats: challenge.game === 'ludo' ? (challenge.seats ?? 2) : challenge.seats,
      seatsFilled: challenge.game === 'ludo' ? (challenge.seatsFilled ?? 1) : challenge.seatsFilled,
      participants: challenge.game === 'ludo'
        ? (challenge.participants ?? [participantFromUser({
            id: challenge.creator.id,
            name: challenge.creator.name,
            avatar: challenge.creator.avatar,
            rating: challenge.creator.rating,
          }, 0)])
        : challenge.participants,
    };
    return normalized;
  });
}

function buildSeedTournaments(source: Tournament[]) {
  return source.map((tournament) => ({
    ...tournament,
    seatsPerMatch: tournament.seatsPerMatch ?? tournamentSeatsForGame(tournament.game),
    rounds: tournament.rounds ?? [],
    participants: tournament.participants ?? [],
    currentRound: tournament.currentRound ?? 0,
    allowSpectators: tournament.allowSpectators ?? true,
    prizePool: Number((tournament.prizePool ?? tournament.stake * tournament.maxPlayers * 0.93).toFixed(2)),
  }));
}

const database = loadDatabase();
const userStore = new Map<string, StoredUser>(database.users.map((user) => [user.id, user]));
const challengeStore = new Map<string, Challenge>(buildSeedChallenges(database.challenges.length ? database.challenges : mockChallenges).map((challenge) => [challenge.id, challenge]));
const tournamentStore = new Map<string, Tournament>(buildSeedTournaments(database.tournaments?.length ? database.tournaments : mockTournaments).map((tournament) => [tournament.id, tournament]));
const walletStore = [...database.walletTransactions];
const matchStore = [...database.matchRecords];
const referralStore = [...database.referralRecords];
const paymentStore = [...(database.paymentRecords ?? [])];
const roomStore = new Map<string, ChallengeRoomState>();
const ludoStore = new Map<string, LudoMatchState>();
const presenceStore = new Map<string, number>();
const roomChatStore = new Map<string, RoomChatMessage[]>();
const ROOM_CHAT_LIMIT = 60;
const PAYSTACK_API_BASE = 'https://api.paystack.co';
const PAYSTACK_CHANNELS: PaymentRuntimeConfig['supportedDepositChannels'] = ['card', 'bank', 'ussd', 'bank_transfer'];

for (const challenge of challengeStore.values()) {
  const roomState = roomStateFromChallenge(challenge);
  if (roomState) roomStore.set(roomState.roomId, roomState);
}

function persistDatabase() {
  saveDatabase({
    users: [...userStore.values()],
    challenges: [...challengeStore.values()],
    tournaments: [...tournamentStore.values()],
    walletTransactions: walletStore,
    matchRecords: matchStore,
    referralRecords: referralStore,
    paymentRecords: paymentStore,
  });
}

function publicUserSummary(user: StoredUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    rating: user.rating,
    tier: user.tier,
    joinedAt: user.joinedAt,
    role: user.role,
    referralCode: user.referralCode,
    online: (presenceStore.get(user.id) ?? 0) > 0,
  };
}

function listUsersFor(currentUserId?: string) {
  return [...userStore.values()]
    .filter((user) => user.id !== currentUserId)
    .map(publicUserSummary)
    .sort((left, right) => Number(right.online) - Number(left.online) || left.username.localeCompare(right.username));
}

function setUserPresence(userId: string, delta: number) {
  const nextValue = Math.max(0, (presenceStore.get(userId) ?? 0) + delta);
  if (nextValue === 0) {
    presenceStore.delete(userId);
    return;
  }
  presenceStore.set(userId, nextValue);
}

function listChallengesFor(userId?: string) {
  return [...challengeStore.values()]
    .filter((challenge) => challenge.source !== 'tournament')
    .filter((challenge) => isVisibleToUser(challenge, userId))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function toTournamentParticipant(user: PlayerIdentity): TournamentParticipant {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    rating: user.rating,
    joinedAt: new Date().toISOString(),
  };
}

function cloneTournament(tournament: Tournament): Tournament {
  return JSON.parse(JSON.stringify(tournament)) as Tournament;
}

function tournamentRoundLabel(game: GameId, roundIndex: number, totalMatches: number, seats: number) {
  if (roundIndex === 0 && game === 'ludo') return 'Group stage';
  if (totalMatches === 1) return seats === 4 ? 'Final table' : 'Grand final';
  if (totalMatches === 2) return 'Semi-finals';
  if (totalMatches === 4) return 'Quarter-finals';
  return `Round ${roundIndex + 1}`;
}

function createTournamentChallenge(params: {
  tournament: Tournament;
  matchId: string;
  seats: 2 | 4;
  participants: TournamentParticipant[];
}): Challenge {
  const { tournament, matchId, seats, participants } = params;
  const creator = participants[0] ?? {
    id: tournament.creator.id,
    name: tournament.creator.name,
    avatar: tournament.creator.avatar,
    rating: tournament.creator.rating,
  };
  const challengeId = `tour-${tournament.id}-${matchId}`;
  return {
    id: challengeId,
    game: tournament.game,
    stake: tournament.stake,
    split: 'winner_takes_all',
    mode: 'friends',
    seats: tournament.game === 'ludo' ? seats : undefined,
    creator: {
      id: creator.id,
      name: creator.name,
      avatar: creator.avatar,
      rating: creator.rating ?? tournament.creator.rating,
    },
    createdAt: new Date().toISOString(),
    status: participants.length >= seats ? 'filled' : 'open',
    roomId: defaultRoomId(challengeId),
    seatsFilled: participants.length,
    participants: participants.map((participant, index) => ({
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      rating: participant.rating,
      seatIndex: index,
      ready: false,
    })),
    inviteScope: 'private',
    inviteCode: `${tournament.game.toUpperCase().slice(0, 3)}-${matchId.slice(-4).toUpperCase()}`,
    source: 'tournament',
    tournamentId: tournament.id,
    tournamentMatchId: matchId,
    allowSpectators: tournament.allowSpectators,
  };
}

function seedTournamentRound(tournament: Tournament, roundIndex: number, participants: TournamentParticipant[], seats: 2 | 4): TournamentRound {
  const matches: TournamentMatch[] = [];
  for (let cursor = 0; cursor < participants.length; cursor += seats) {
    const grouped = participants.slice(cursor, cursor + seats);
    const matchId = `${tournament.id}-r${roundIndex + 1}-m${matches.length + 1}`;
    const challenge = createTournamentChallenge({
      tournament,
      matchId,
      seats: grouped.length <= 2 ? 2 : seats,
      participants: grouped,
    });
    challengeStore.set(challenge.id, challenge);
    const room = ensureRoomForChallenge(challenge);
    if (room) roomStore.set(room.roomId, room);

    matches.push({
      id: matchId,
      roundIndex,
      position: matches.length,
      seats: grouped.length <= 2 ? 2 : seats,
      status: grouped.length >= (grouped.length <= 2 ? 2 : seats) ? 'ready' : 'waiting',
      participants: grouped,
      winnerUserId: null,
      challenge,
    });
  }

  return {
    index: roundIndex,
    label: tournamentRoundLabel(tournament.game, roundIndex, matches.length, seats),
    matches,
  };
}

function createTournamentFromPayload(payload: CreateTournamentPayload) {
  const game = payload.game as GameId;
  const seatsPerMatch = tournamentSeatsForGame(game);
  const creator = payload.creator!;
  const participant = toTournamentParticipant(creator);
  const maxPlayers = Number(payload.maxPlayers);
  const stake = Number(payload.stake ?? 0);
  const title = payload.title?.trim() || `${game} tournament`;
  return {
    id: `tour_${Math.random().toString(36).slice(2, 10)}`,
    title,
    game,
    stake,
    maxPlayers,
    seatsPerMatch,
    createdAt: new Date().toISOString(),
    status: 'open',
    allowSpectators: payload.allowSpectators !== false,
    prizePool: Number((stake * maxPlayers * 0.93).toFixed(2)),
    creator: {
      id: creator.id,
      name: creator.name,
      avatar: creator.avatar,
      rating: creator.rating ?? 1500,
    },
    participants: [participant],
    rounds: [],
    currentRound: 0,
  } satisfies Tournament;
}

function maybeStartTournament(tournament: Tournament) {
  if (tournament.status !== 'open' || tournament.participants.length < tournament.maxPlayers) return tournament;
  const seededRound = seedTournamentRound(tournament, 0, tournament.participants, tournament.seatsPerMatch);
  tournament.rounds = [seededRound];
  tournament.currentRound = 0;
  tournament.status = 'live';
  return tournament;
}

function advanceTournamentBracket(tournament: Tournament) {
  const currentRound = tournament.rounds[tournament.currentRound];
  if (!currentRound || currentRound.matches.some((match) => match.status !== 'finished' || !match.winnerUserId)) {
    return tournament;
  }

  const winners = currentRound.matches
    .map((match) => match.participants.find((participant) => participant.id === match.winnerUserId))
    .filter(Boolean) as TournamentParticipant[];

  if (winners.length <= 1) {
    tournament.status = 'completed';
    return tournament;
  }

  const nextSeats = tournament.game === 'ludo'
    ? (winners.length <= 2 ? 2 : 4)
    : 2;
  const nextRound = seedTournamentRound(tournament, tournament.currentRound + 1, winners, nextSeats);
  tournament.rounds.push(nextRound);
  tournament.currentRound += 1;
  tournament.status = 'live';
  return tournament;
}

function listTournamentsFor(_userId?: string) {
  return [...tournamentStore.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getRecordText(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function getRecordNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function listTransactionsForUser(userId: string, limit = 12) {
  return walletStore
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, limit)
    .map(({ userId: _userId, balanceAfter: _balanceAfter, ...entry }) => entry);
}

function listPaymentsForUser(userId: string, limit = 12) {
  return paymentStore
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

function getPaystackPublicKey() {
  const key = process.env.VITE_PAYSTACK_PUBLIC_KEY?.trim();
  return key || null;
}

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  return key || null;
}

function getPaystackWebhookSecret() {
  return process.env.PAYSTACK_WEBHOOK_SECRET?.trim() || getPaystackSecretKey();
}

function isPaystackConfigured() {
  return Boolean(getPaystackPublicKey() && getPaystackSecretKey());
}

function buildPaymentsConfig(): PaymentRuntimeConfig {
  const configured = isPaystackConfigured();
  return {
    provider: configured ? 'paystack' : null,
    depositsEnabled: configured,
    withdrawalsEnabled: configured,
    inlineCheckoutEnabled: configured,
    supportedDepositChannels: PAYSTACK_CHANNELS,
    message: configured
      ? 'Paystack test mode is ready for Nigerian wallet funding and withdrawals.'
      : 'Paystack is not configured on the server yet.',
  };
}

function toKobo(amount: number) {
  return Math.round(amount * 100);
}

function fromKobo(amount: unknown) {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return Number((amount / 100).toFixed(2));
  }
  if (typeof amount === 'string') {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Number((parsed / 100).toFixed(2)) : 0;
  }
  return 0;
}

function generatePaymentReference(prefix: 'dep' | 'wdr') {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toLowerCase();
  return `ska-${prefix}-${Date.now()}-${suffix}`;
}

async function paystackRequest<T>(path: string, init?: {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
}) {
  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    throw new Error('Paystack is not configured on the server yet.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    Accept: 'application/json',
  };

  let body: string | undefined;
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body,
  });

  const payload = await response.json().catch(() => null) as PaystackEnvelope<T> | null;
  if (!response.ok || !payload?.status) {
    throw new Error(payload?.message || `Paystack request failed with status ${response.status}.`);
  }
  return payload;
}

function getProviderTransactionId(data: Record<string, unknown> | null) {
  return getRecordText(data, 'id') ?? getRecordText(data, 'transfer_code');
}

function normalizeProviderStatus(kind: PaymentRecord['kind'], statusText?: string | null): PaymentStatus {
  const normalized = statusText?.trim().toLowerCase() ?? '';
  if (!normalized) return 'pending';

  if (kind === 'deposit') {
    if (['success', 'successful', 'completed'].includes(normalized)) return 'completed';
    if (normalized === 'abandoned') return 'abandoned';
    if (['failed', 'reversed'].includes(normalized)) return 'failed';
    if (['pending', 'processing', 'ongoing', 'queued'].includes(normalized)) return 'processing';
    return 'pending';
  }

  if (['success', 'successful', 'completed'].includes(normalized)) return 'completed';
  if (['failed', 'reversed'].includes(normalized)) return 'failed';
  if (['pending', 'processing', 'received', 'queued', 'otp'].includes(normalized)) return 'processing';
  return 'pending';
}

function mergePaymentMetadata(
  payment: StoredPaymentRecord,
  addition?: Record<string, string | number | boolean | null>,
) {
  if (!addition) return payment.metadata ?? null;
  return {
    ...(payment.metadata ?? {}),
    ...addition,
  };
}

function createPaymentRecord(input: Parameters<typeof createStoredPaymentRecord>[0]) {
  const payment = createStoredPaymentRecord(input);
  paymentStore.unshift(payment);
  return payment;
}

function findPaymentByReference(reference?: string | null, userId?: string | null) {
  if (!reference) return null;
  return paymentStore.find((entry) => entry.reference === reference && (!userId || entry.userId === userId)) ?? null;
}

function updatePaymentRecord(payment: StoredPaymentRecord, patch: Partial<StoredPaymentRecord>) {
  const nextUpdatedAt = patch.updatedAt ?? new Date().toISOString();
  Object.assign(payment, {
    ...patch,
    updatedAt: nextUpdatedAt,
  });
  return payment;
}

function findWalletTransaction(walletTransactionId?: string | null) {
  if (!walletTransactionId) return null;
  return walletStore.find((entry) => entry.id === walletTransactionId) ?? null;
}

function applyWalletMutation(user: StoredUser, entry: {
  amount: number;
  type: StoredWalletTransaction['type'];
  description: string;
  game?: GameId;
  status?: StoredWalletTransaction['status'];
}) {
  const status = entry.status ?? 'completed';
  user.balance = Number((user.balance + entry.amount).toFixed(2));
  if (entry.type === 'deposit' && status === 'completed') {
    user.totalDeposited = Number((user.totalDeposited + Math.max(entry.amount, 0)).toFixed(2));
  }
  if (entry.type === 'withdrawal' && status === 'completed') {
    user.totalWithdrawn = Number((user.totalWithdrawn + Math.abs(entry.amount)).toFixed(2));
  }
  if (entry.type === 'referral_bonus' && status === 'completed') {
    user.referralEarnings = Number((user.referralEarnings + Math.max(entry.amount, 0)).toFixed(2));
  }
  const tx = createStoredWalletTransaction({
    userId: user.id,
    balanceAfter: user.balance,
    amount: entry.amount,
    type: entry.type,
    description: entry.description,
    game: entry.game,
    status,
  });
  walletStore.unshift(tx);
  userStore.set(user.id, user);
  return tx;
}

function reserveWithdrawalBalance(user: StoredUser, amount: number, description: string) {
  return applyWalletMutation(user, {
    amount: -amount,
    type: 'withdrawal',
    description,
    status: 'pending',
  });
}

function finalizeDepositPayment(payment: StoredPaymentRecord, providerData?: Record<string, unknown> | null) {
  if (payment.status === 'completed') return payment;
  const user = requireUser(payment.userId);
  if (!user) {
    return updatePaymentRecord(payment, {
      status: 'failed',
      failureReason: 'Player account no longer exists.',
    });
  }

  let walletTransactionId = payment.walletTransactionId;
  if (!walletTransactionId) {
    const tx = applyWalletMutation(user, {
      amount: payment.amount,
      type: 'deposit',
      description: payment.description,
      status: 'completed',
    });
    walletTransactionId = tx.id;
  } else {
    const walletTx = findWalletTransaction(walletTransactionId);
    if (walletTx) walletTx.status = 'completed';
  }

  const providerRecord = providerData ?? null;
  const paidAt = getRecordText(providerRecord, 'paid_at') ?? getRecordText(providerRecord, 'transaction_date');
  return updatePaymentRecord(payment, {
    status: 'completed',
    walletTransactionId,
    providerTransactionId: getProviderTransactionId(providerRecord) ?? payment.providerTransactionId,
    failureReason: null,
    metadata: mergePaymentMetadata(payment, {
      providerStatus: getRecordText(providerRecord, 'status'),
    }),
    completedAt: paidAt ?? new Date().toISOString(),
  });
}

function failDepositPayment(payment: StoredPaymentRecord, reason: string, status: Extract<PaymentStatus, 'failed' | 'abandoned'> = 'failed') {
  return updatePaymentRecord(payment, {
    status,
    failureReason: reason,
    completedAt: null,
    metadata: mergePaymentMetadata(payment, {
      providerStatus: status,
    }),
  });
}

function completeWithdrawalPayment(payment: StoredPaymentRecord, providerData?: Record<string, unknown> | null) {
  if (payment.status === 'completed') return payment;
  const walletTx = findWalletTransaction(payment.walletTransactionId);
  if (walletTx) walletTx.status = 'completed';
  const user = requireUser(payment.userId);
  if (user) {
    user.totalWithdrawn = Number((user.totalWithdrawn + payment.amount).toFixed(2));
    userStore.set(user.id, user);
  }

  const providerRecord = providerData ?? null;
  return updatePaymentRecord(payment, {
    status: 'completed',
    providerTransactionId: getProviderTransactionId(providerRecord) ?? payment.providerTransactionId,
    failureReason: null,
    metadata: mergePaymentMetadata(payment, {
      providerStatus: getRecordText(providerRecord, 'status'),
    }),
    completedAt: new Date().toISOString(),
  });
}

function failWithdrawalPayment(
  payment: StoredPaymentRecord,
  reason: string,
  status: Extract<PaymentStatus, 'failed' | 'abandoned'> = 'failed',
) {
  if (payment.status === 'completed') return payment;

  const walletTx = findWalletTransaction(payment.walletTransactionId);
  if (walletTx) walletTx.status = 'failed';
  const user = requireUser(payment.userId);
  const existingReversalId = typeof payment.metadata?.reversalTransactionId === 'string'
    ? payment.metadata.reversalTransactionId
    : null;
  const metadata = {
    ...(payment.metadata ?? {}),
  };

  if (user && payment.walletTransactionId && !existingReversalId) {
    const reversalTx = applyWalletMutation(user, {
      amount: payment.amount,
      type: 'adjustment',
      description: `Withdrawal reversal • ${payment.reference}`,
      status: 'completed',
    });
    if (metadata) metadata.reversalTransactionId = reversalTx.id;
  }

  return updatePaymentRecord(payment, {
    status,
    failureReason: reason,
    metadata,
  });
}

async function resolvePaystackBankAccount(params: {
  bankCode: string;
  accountNumber: string;
  bankName?: string | null;
}) {
  const bankCode = params.bankCode.trim();
  const accountNumber = params.accountNumber.trim();
  const envelope = await paystackRequest<Record<string, unknown>>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  const data = getRecord(envelope.data);
  const resolved = {
    accountNumber: getRecordText(data, 'account_number') ?? accountNumber,
    accountName: getRecordText(data, 'account_name') ?? 'Verified account',
    bankCode,
    bankName: params.bankName?.trim() || 'Nigerian bank',
  } satisfies ResolvedBankAccount;
  return resolved;
}

async function listSupportedBanks() {
  const envelope = await paystackRequest<Array<Record<string, unknown>>>('/bank?country=nigeria&use_cursor=false&perPage=100');
  const banks = (Array.isArray(envelope.data) ? envelope.data : [])
    .map((entry) => {
      const record = getRecord(entry);
      const code = getRecordText(record, 'code');
      const name = getRecordText(record, 'name');
      if (!code || !name) return null;
      return {
        code,
        name,
        slug: getRecordText(record, 'slug') ?? undefined,
      } satisfies SupportedBank;
    })
    .filter(Boolean) as SupportedBank[];
  return banks.sort((left, right) => left.name.localeCompare(right.name));
}

async function syncPaymentWithProvider(payment: StoredPaymentRecord) {
  if (payment.status === 'completed' || payment.status === 'failed' || payment.status === 'abandoned') {
    return payment;
  }

  if (payment.kind === 'deposit') {
    const envelope = await paystackRequest<Record<string, unknown>>(`/transaction/verify/${encodeURIComponent(payment.reference)}`);
    const data = getRecord(envelope.data);
    const providerStatus = getRecordText(data, 'status');
    const status = normalizeProviderStatus('deposit', providerStatus);
    if (status === 'completed') return finalizeDepositPayment(payment, data);
    if (status === 'failed') return failDepositPayment(payment, getRecordText(data, 'gateway_response') ?? envelope.message, 'failed');
    if (status === 'abandoned') return failDepositPayment(payment, getRecordText(data, 'gateway_response') ?? 'Player abandoned the checkout.', 'abandoned');
    return updatePaymentRecord(payment, {
      status,
      providerTransactionId: getProviderTransactionId(data) ?? payment.providerTransactionId,
      metadata: mergePaymentMetadata(payment, {
        providerStatus,
      }),
    });
  }

  const envelope = await paystackRequest<Record<string, unknown>>(`/transfer/verify/${encodeURIComponent(payment.reference)}`);
  const data = getRecord(envelope.data);
  const providerStatus = getRecordText(data, 'status');
  const status = normalizeProviderStatus('withdrawal', providerStatus);
  if (status === 'completed') return completeWithdrawalPayment(payment, data);
  if (status === 'failed' || providerStatus === 'reversed') {
    return failWithdrawalPayment(payment, envelope.message || 'Withdrawal was not completed.', 'failed');
  }
  return updatePaymentRecord(payment, {
    status,
    providerTransactionId: getProviderTransactionId(data) ?? payment.providerTransactionId,
    metadata: mergePaymentMetadata(payment, {
      providerStatus,
    }),
  });
}

function recordMatchForUser(user: StoredUser, payload: Required<Pick<RecordMatchPayload, 'game' | 'result' | 'score' | 'stake' | 'payout'>> & {
  opponentName?: string;
  opponentAvatar?: string;
  closingBalance?: number;
}) {
  if (Number.isFinite(payload.closingBalance) && payload.closingBalance! >= 0) {
    user.balance = Number(payload.closingBalance!.toFixed(2));
  }
  user.totalMatches += 1;
  user.totalWagered = Number((user.totalWagered + payload.stake).toFixed(2));
  user.totalPayouts = Number((user.totalPayouts + payload.payout).toFixed(2));
  if (payload.result === 'win') user.totalWins += 1;
  if (payload.result === 'loss') user.totalLosses += 1;
  if (payload.result === 'draw') user.totalDraws += 1;
  userStore.set(user.id, user);

  const record = createStoredMatchRecord({
    userId: user.id,
    game: payload.game,
    result: payload.result,
    score: payload.score,
    stake: payload.stake,
    payout: payload.payout,
    opponent: {
      name: payload.opponentName?.trim() || 'Arena rival',
      avatar: payload.opponentAvatar?.trim() || '🎯',
    },
  });
  matchStore.unshift(record);

  if (payload.stake > 0) {
    walletStore.unshift(createStoredWalletTransaction({
      userId: user.id,
      balanceAfter: user.balance,
      type: 'wager',
      amount: Number((-payload.stake).toFixed(2)),
      description: `${payload.game} stake locked`,
      game: payload.game,
    }));
  }
  if (payload.payout > 0) {
    walletStore.unshift(createStoredWalletTransaction({
      userId: user.id,
      balanceAfter: user.balance,
      type: payload.result === 'draw' ? 'refund' : 'win',
      amount: payload.payout,
      description: payload.result === 'draw' ? `${payload.game} draw refund` : `${payload.game} payout`,
      game: payload.game,
    }));
  }

  return record;
}

function requireUser(userId?: string | null) {
  if (!userId) return null;
  return userStore.get(userId) ?? null;
}

function normalizeLoginIdentifier(identifier?: string | null) {
  return identifier?.trim().toLowerCase() ?? '';
}

function findUserByIdentifier(identifier?: string | null) {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized) return null;
  return [...userStore.values()].find((candidate) => candidate.email === normalized || candidate.username === normalized) ?? null;
}

function requireAdmin(userId?: string | null) {
  const user = requireUser(userId);
  if (!user || user.role !== 'admin') return null;
  return user;
}

function emitChallenge(io: Server, challenge: Challenge) {
  if (challenge.source === 'tournament') return;
  if (challenge.inviteScope === 'private') {
    io.to(`user:${challenge.creator.id}`).emit('challenge:upsert', challenge);
    if (challenge.invitedUserId) io.to(`user:${challenge.invitedUserId}`).emit('challenge:upsert', challenge);
    challenge.invitedUsers?.forEach((invite) => {
      if (invite.id) io.to(`user:${invite.id}`).emit('challenge:upsert', challenge);
    });
    challenge.participants?.forEach((participant) => io.to(`user:${participant.id}`).emit('challenge:upsert', challenge));
    return;
  }
  io.emit('challenge:upsert', challenge);
}

function emitRoom(io: Server, room: ChallengeRoomState) {
  io.to(room.roomId).emit('room:state', room);
  room.participants.forEach((participant) => io.to(`user:${participant.id}`).emit('room:state', room));
}

function emitLudo(io: Server, match: LudoMatchState) {
  io.to(match.roomId).emit('ludo:state', match);
}

function emitRoomChat(io: Server, message: RoomChatMessage) {
  io.to(message.roomId).emit('chat:message', message);
}

function ensureRoomForChallenge(challenge: Challenge) {
  if (!challenge.roomId) return null;
  const existing = roomStore.get(challenge.roomId);
  if (existing) return existing;
  const room = roomStateFromChallenge(challenge);
  if (!room) return null;
  roomStore.set(room.roomId, room);
  return room;
}

function syncChallengeAndRoomState(io: Server, room: ChallengeRoomState, status: Challenge['status']) {
  roomStore.set(room.roomId, room);
  const challenge = challengeStore.get(room.challengeId);
  if (!challenge) return;

  challenge.participants = room.participants;
  challenge.status = status;
  challenge.seatsFilled = room.participants.length;
  challengeStore.set(challenge.id, challenge);
  persistDatabase();
  emitChallenge(io, challenge);
  emitRoom(io, room);
}

function roomAccessFor(roomId: string, userId?: string) {
  const room = roomStore.get(roomId);
  if (!room) return { room: null, challenge: null, error: 'Room not found.' };
  const challenge = challengeStore.get(room.challengeId);
  if (!challenge) return { room, challenge: null, error: 'Challenge not found for this room.' };
  const spectatorAllowed = !!challenge.allowSpectators && !!userId;
  if (!spectatorAllowed && !canAccessChallengeRoom(challenge, userId)) {
    return { room, challenge, error: 'You do not have access to this room.' };
  }
  return { room, challenge, error: null };
}

function listRoomMessages(roomId: string) {
  return roomChatStore.get(roomId) ?? [];
}

function appendRoomMessage(roomId: string, message: RoomChatMessage) {
  const nextMessages = [...listRoomMessages(roomId), message].slice(-ROOM_CHAT_LIMIT);
  roomChatStore.set(roomId, nextMessages);
  return message;
}

function updateTournamentMatchStateFromChallenge(challengeId: string, status: TournamentMatch['status'], winnerUserId?: string | null) {
  const challenge = challengeStore.get(challengeId);
  if (!challenge?.tournamentId || !challenge.tournamentMatchId) return;
  const tournament = tournamentStore.get(challenge.tournamentId);
  if (!tournament) return;

  const nextTournament = cloneTournament(tournament);
  const round = nextTournament.rounds.find((entry) => entry.matches.some((match) => match.id === challenge.tournamentMatchId));
  const match = round?.matches.find((entry) => entry.id === challenge.tournamentMatchId);
  if (!round || !match) return;

  match.status = status;
  if (winnerUserId !== undefined) {
    match.winnerUserId = winnerUserId;
  }
  if (match.challenge) {
    match.challenge.status = challenge.status;
    match.challenge.participants = challenge.participants;
    match.challenge.seatsFilled = challenge.seatsFilled;
  }
  if (status === 'finished') {
    advanceTournamentBracket(nextTournament);
  }

  tournamentStore.set(nextTournament.id, nextTournament);
  persistDatabase();
}

const app = express();
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
}));

app.post('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const webhookSecret = getPaystackWebhookSecret();
  const signature = req.header('x-paystack-signature')?.trim();
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

  if (!webhookSecret || !signature || !rawBody.length) {
    res.status(400).json({ ok: false, error: 'Invalid webhook payload.' });
    return;
  }

  const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
  if (expected !== signature) {
    res.status(401).json({ ok: false, error: 'Webhook signature is invalid.' });
    return;
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = getRecord(JSON.parse(rawBody.toString('utf8')));
  } catch {
    res.status(400).json({ ok: false, error: 'Webhook JSON is invalid.' });
    return;
  }
  const eventName = getRecordText(payload, 'event');
  const data = getRecord(payload?.data);
  const reference = getRecordText(data, 'reference');
  const payment = findPaymentByReference(reference);

  if (!payment || !eventName) {
    res.status(200).json({ ok: true });
    return;
  }

  if (eventName === 'charge.success' && payment.kind === 'deposit') {
    finalizeDepositPayment(payment, data);
    persistDatabase();
    res.status(200).json({ ok: true });
    return;
  }

  if (eventName === 'transfer.success' && payment.kind === 'withdrawal') {
    completeWithdrawalPayment(payment, data);
    persistDatabase();
    res.status(200).json({ ok: true });
    return;
  }

  if ((eventName === 'transfer.failed' || eventName === 'transfer.reversed') && payment.kind === 'withdrawal') {
    failWithdrawalPayment(payment, getRecordText(data, 'status') ?? eventName, 'failed');
    persistDatabase();
    res.status(200).json({ ok: true });
    return;
  }

  res.status(200).json({ ok: true });
});

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    users: userStore.size,
    onlineUsers: presenceStore.size,
    rooms: roomStore.size,
    challenges: challengeStore.size,
    walletTransactions: walletStore.length,
    matchRecords: matchStore.length,
    referrals: referralStore.length,
    payments: paymentStore.length,
    time: new Date().toISOString(),
  });
});

app.post('/api/auth/request-email-code', async (req, res) => {
  const payload = req.body as RequestEmailCodePayload;
  const email = payload.email?.trim().toLowerCase() ?? '';
  const firstName = sanitizeHumanName(payload.firstName);

  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
    return;
  }

  if (!isEmailVerificationConfigured()) {
    res.status(503).json({ ok: false, error: 'Email verification is not configured on the server yet.' });
    return;
  }

  if ([...userStore.values()].some((user) => user.email === email)) {
    res.status(409).json({ ok: false, error: 'That email is already registered.' });
    return;
  }

  const existingSession = cleanupExpiredEmailVerification(email);
  const now = Date.now();
  if (existingSession && now - existingSession.requestedAt < VERIFICATION_RESEND_WINDOW_MS) {
    res.status(429).json({
      ok: false,
      error: 'Wait a few seconds before requesting another code.',
      resendAvailableInSeconds: Math.ceil((VERIFICATION_RESEND_WINDOW_MS - (now - existingSession.requestedAt)) / 1000),
    });
    return;
  }

  const code = generateVerificationCode();
  const nextSession: EmailVerificationSession = {
    email,
    firstName,
    codeHash: hashVerificationCode(email, code),
    requestedAt: now,
    expiresAt: now + VERIFICATION_CODE_TTL_MS,
    attempts: 0,
    verifiedAt: null,
    verificationToken: null,
  };

  try {
    await sendEmailVerificationCode({ email, firstName, code });
    emailVerificationStore.set(email, nextSession);
    res.json({
      ok: true,
      expiresInSeconds: Math.round(VERIFICATION_CODE_TTL_MS / 1000),
      resendAvailableInSeconds: Math.round(VERIFICATION_RESEND_WINDOW_MS / 1000),
    });
  } catch (error) {
    emailVerificationStore.delete(email);
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Could not send the verification email.',
    });
  }
});

app.post('/api/auth/verify-email-code', (req, res) => {
  const payload = req.body as VerifyEmailCodePayload;
  const email = payload.email?.trim().toLowerCase() ?? '';
  const code = payload.code?.trim() ?? '';

  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
    return;
  }
  if (!VERIFICATION_CODE_PATTERN.test(code)) {
    res.status(400).json({ ok: false, error: 'Enter the 6-digit verification code.' });
    return;
  }

  const session = cleanupExpiredEmailVerification(email);
  if (!session) {
    res.status(400).json({ ok: false, error: 'This verification code expired. Request a fresh one.' });
    return;
  }

  if (session.attempts >= VERIFICATION_MAX_ATTEMPTS) {
    emailVerificationStore.delete(email);
    res.status(429).json({ ok: false, error: 'Too many incorrect attempts. Request a fresh verification code.' });
    return;
  }

  const codeHash = hashVerificationCode(email, code);
  if (codeHash !== session.codeHash) {
    session.attempts += 1;
    emailVerificationStore.set(email, session);
    res.status(401).json({ ok: false, error: 'That verification code is incorrect.' });
    return;
  }

  session.verifiedAt = Date.now();
  session.expiresAt = session.verifiedAt + VERIFIED_EMAIL_TTL_MS;
  session.verificationToken = createVerificationToken();
  session.attempts = 0;
  emailVerificationStore.set(email, session);

  res.json({
    ok: true,
    verificationToken: session.verificationToken,
    expiresInSeconds: Math.round(VERIFIED_EMAIL_TTL_MS / 1000),
  });
});

app.post('/api/auth/register', (req, res) => {
  const payload = req.body as RegisterPayload;
  const firstName = sanitizeHumanName(payload.firstName);
  const lastName = sanitizeHumanName(payload.lastName);
  const email = payload.email?.trim().toLowerCase() ?? '';
  const phone = sanitizePhone(payload.phone);
  const country = sanitizeHumanName(payload.country);
  const dateOfBirth = payload.dateOfBirth?.trim() ?? '';
  const username = payload.username?.trim().toLowerCase() ?? '';
  const password = payload.password?.trim() ?? '';
  const displayName = payload.displayName?.trim() ?? '';
  const avatar = payload.avatar?.trim() ?? '';
  const referralCode = payload.referralCode?.trim().toUpperCase() ?? '';
  const verificationToken = payload.verificationToken?.trim() ?? '';
  const age = getAgeFromDateOfBirth(dateOfBirth);

  if (!firstName || !lastName || !email || !phone || !country || !dateOfBirth || !username || !password || !displayName || !avatar) {
    res.status(400).json({ ok: false, error: 'Complete every registration field.' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
    return;
  }
  if (phone.replace(/\D/g, '').length < 10) {
    res.status(400).json({ ok: false, error: 'Enter a working phone number.' });
    return;
  }
  if (country.length < 2) {
    res.status(400).json({ ok: false, error: 'Enter your country or region.' });
    return;
  }
  if (age === null) {
    res.status(400).json({ ok: false, error: 'Choose a valid date of birth.' });
    return;
  }
  if (age < 18) {
    res.status(400).json({ ok: false, error: 'You must be at least 18 years old to register.' });
    return;
  }
  if (!USERNAME_PATTERN.test(username)) {
    res.status(400).json({ ok: false, error: 'Username must be 3-20 characters using letters, numbers, or underscores.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
    return;
  }
  if (displayName.length < 2) {
    res.status(400).json({ ok: false, error: 'Enter a display name for your player card.' });
    return;
  }
  if (!verificationToken) {
    res.status(403).json({ ok: false, error: 'Verify your email before creating the account.' });
    return;
  }
  if (userStore.size > 0 && [...userStore.values()].some((user) => user.email === email)) {
    res.status(409).json({ ok: false, error: 'That email is already registered.' });
    return;
  }
  if ([...userStore.values()].some((user) => user.username === username)) {
    res.status(409).json({ ok: false, error: 'That username is already taken.' });
    return;
  }
  const referrer = referralCode
    ? [...userStore.values()].find((candidate) => candidate.referralCode === referralCode)
    : undefined;
  if (referralCode && !referrer) {
    res.status(404).json({ ok: false, error: 'Referral code not found.' });
    return;
  }
  const emailVerification = cleanupExpiredEmailVerification(email);
  if (!emailVerification || !emailVerification.verifiedAt || emailVerification.verificationToken !== verificationToken) {
    res.status(403).json({ ok: false, error: 'Your email verification expired. Request a new code and try again.' });
    return;
  }

  const user = createStoredUser({
    firstName,
    lastName,
    email,
    phone,
    country,
    dateOfBirth,
    username,
    password,
    displayName,
    avatar,
    referredByCode: referrer?.referralCode ?? null,
    role: userStore.size === 0 ? 'admin' : undefined,
  });

  userStore.set(user.id, user);
  if (referrer) {
    referrer.referralPoints += REFERRAL_REWARD_POINTS;
    applyWalletMutation(referrer, {
      amount: REFERRAL_REWARD_AMOUNT,
      type: 'referral_bonus',
      description: `Referral bonus for ${user.displayName}`,
    });
    referralStore.unshift(createReferralRecord({
      referrerUserId: referrer.id,
      referredUserId: user.id,
      code: referrer.referralCode,
    }));
  }
  emailVerificationStore.delete(email);
  persistDatabase();

  res.json({
    ok: true,
    user: toPublicUser(user),
    balance: user.balance,
  });
});

app.post('/api/auth/login', (req, res) => {
  const payload = req.body as LoginPayload;
  const identifier = normalizeLoginIdentifier(payload.identifier || payload.email);
  const password = payload.password?.trim() ?? '';
  const user = findUserByIdentifier(identifier);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ ok: false, error: 'Incorrect email, username, or password.' });
    return;
  }

  res.json({
    ok: true,
    user: toPublicUser(user),
    balance: user.balance,
  });
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const payload = req.body as RequestPasswordResetPayload;
  const identifier = normalizeLoginIdentifier(payload.identifier);
  if (!identifier) {
    res.status(400).json({ ok: false, error: 'Enter your email or username.' });
    return;
  }
  if (!isEmailVerificationConfigured()) {
    res.status(503).json({ ok: false, error: 'Password recovery email is not configured on the server yet.' });
    return;
  }

  const user = findUserByIdentifier(identifier);
  if (!user) {
    res.status(404).json({ ok: false, error: 'No account was found for that email or username.' });
    return;
  }

  const existingSession = cleanupExpiredPasswordReset(identifier);
  const now = Date.now();
  if (existingSession && now - existingSession.requestedAt < PASSWORD_RESET_RESEND_WINDOW_MS) {
    res.status(429).json({
      ok: false,
      error: 'Wait a few seconds before requesting another reset code.',
      resendAvailableInSeconds: Math.ceil((PASSWORD_RESET_RESEND_WINDOW_MS - (now - existingSession.requestedAt)) / 1000),
    });
    return;
  }

  const code = generateVerificationCode();
  const nextSession: PasswordResetSession = {
    identifier,
    email: user.email,
    userId: user.id,
    firstName: user.firstName,
    codeHash: hashVerificationCode(user.email, code),
    requestedAt: now,
    expiresAt: now + PASSWORD_RESET_TTL_MS,
    attempts: 0,
  };

  try {
    await sendPasswordResetCode({ email: user.email, firstName: user.firstName, code });
    passwordResetStore.set(identifier, nextSession);
    if (identifier !== user.email) {
      passwordResetStore.set(user.email, nextSession);
    }
    if (identifier !== user.username) {
      passwordResetStore.set(user.username, nextSession);
    }
    res.json({
      ok: true,
      expiresInSeconds: Math.round(PASSWORD_RESET_TTL_MS / 1000),
      resendAvailableInSeconds: Math.round(PASSWORD_RESET_RESEND_WINDOW_MS / 1000),
    });
  } catch (error) {
    passwordResetStore.delete(identifier);
    passwordResetStore.delete(user.email);
    passwordResetStore.delete(user.username);
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Could not send the password reset email.',
    });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  const payload = req.body as ResetPasswordPayload;
  const identifier = normalizeLoginIdentifier(payload.identifier);
  const code = payload.code?.trim() ?? '';
  const newPassword = payload.newPassword?.trim() ?? '';

  if (!identifier) {
    res.status(400).json({ ok: false, error: 'Enter your email or username.' });
    return;
  }
  if (!VERIFICATION_CODE_PATTERN.test(code)) {
    res.status(400).json({ ok: false, error: 'Enter the 6-digit reset code.' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
    return;
  }

  const session = cleanupExpiredPasswordReset(identifier);
  if (!session) {
    res.status(400).json({ ok: false, error: 'This reset code expired. Request a fresh one.' });
    return;
  }
  if (session.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    passwordResetStore.delete(session.identifier);
    passwordResetStore.delete(session.email);
    const sessionUser = requireUser(session.userId);
    if (sessionUser) passwordResetStore.delete(sessionUser.username);
    res.status(429).json({ ok: false, error: 'Too many incorrect attempts. Request a fresh reset code.' });
    return;
  }

  const user = requireUser(session.userId);
  if (!user) {
    passwordResetStore.delete(session.identifier);
    passwordResetStore.delete(session.email);
    res.status(404).json({ ok: false, error: 'This account could not be found anymore.' });
    return;
  }

  const codeHash = hashVerificationCode(session.email, code);
  if (codeHash !== session.codeHash) {
    session.attempts += 1;
    passwordResetStore.set(session.identifier, session);
    passwordResetStore.set(session.email, session);
    passwordResetStore.set(user.username, session);
    res.status(401).json({ ok: false, error: 'That reset code is incorrect.' });
    return;
  }

  user.passwordHash = hashPassword(newPassword);
  userStore.set(user.id, user);
  passwordResetStore.delete(session.identifier);
  passwordResetStore.delete(session.email);
  passwordResetStore.delete(user.username);
  persistDatabase();

  res.json({
    ok: true,
    user: toPublicUser(user),
    balance: user.balance,
  });
});

app.get('/api/users', (req, res) => {
  const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;
  res.json({
    ok: true,
    users: listUsersFor(excludeId),
  });
});

app.get('/api/wallet/:userId', (req, res) => {
  const user = userStore.get(req.params.userId);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  res.json({
    ok: true,
    balance: user.balance,
  });
});

app.get('/api/wallet/:userId/transactions', (req, res) => {
  const user = userStore.get(req.params.userId);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  res.json({
    ok: true,
    transactions: walletStore
      .filter((entry) => entry.userId === user.id)
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .map(({ userId: _userId, balanceAfter: _balanceAfter, ...entry }) => entry),
  });
});

function buildProfileResponse(user: StoredUser) {
  return {
    ok: true,
    user: toPublicUser(user),
    profile: buildUserProfileSnapshot({
      user,
      walletTransactions: walletStore,
      matchRecords: matchStore,
      referralRecords: referralStore,
      usersById: new Map([...userStore.values()].map((entry) => [entry.id, entry])),
    }),
  };
}

app.patch('/api/users/:userId/balance', (req, res) => {
  const user = userStore.get(req.params.userId);
  const nextBalance = Number(req.body?.balance);

  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!Number.isFinite(nextBalance) || nextBalance < 0) {
    res.status(400).json({ ok: false, error: 'Balance must be a valid positive number.' });
    return;
  }

  user.balance = Number(nextBalance.toFixed(2));
  userStore.set(user.id, user);
  persistDatabase();

  res.json({
    ok: true,
    balance: user.balance,
  });
});

app.get('/api/users/:userId/profile', (req, res) => {
  const user = userStore.get(req.params.userId);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  res.json(buildProfileResponse(user));
});

app.patch('/api/users/:userId/profile', (req, res) => {
  const user = userStore.get(req.params.userId);
  const payload = (req.body ?? {}) as UpdateProfilePayload;

  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  const nextDisplayName = String(payload.displayName ?? user.displayName).trim().replace(/\s+/g, ' ');
  const nextCountry = String(payload.country ?? user.country).trim().replace(/\s+/g, ' ');
  const nextAvatar = String(payload.avatar ?? user.avatar).trim();
  const nextProfileImageRaw = typeof payload.profileImage === 'string' ? payload.profileImage.trim() : payload.profileImage;
  const nextPhone = String(payload.phone ?? user.phone).trim();
  const normalizedDigits = nextPhone.replace(/\D/g, '');

  if (!nextDisplayName) {
    res.status(400).json({ ok: false, error: 'Display name is required.' });
    return;
  }
  if (!nextCountry) {
    res.status(400).json({ ok: false, error: 'Country is required.' });
    return;
  }
  if (!nextAvatar) {
    res.status(400).json({ ok: false, error: 'Select an avatar.' });
    return;
  }
  if (normalizedDigits.length < 7 || normalizedDigits.length > 15) {
    res.status(400).json({ ok: false, error: 'Enter a valid phone number.' });
    return;
  }
  if (nextProfileImageRaw && nextProfileImageRaw.length > 2_500_000) {
    res.status(400).json({ ok: false, error: 'Profile picture is too large. Please use a smaller image.' });
    return;
  }

  const duplicate = [...userStore.values()].find((candidate) => (
    candidate.id !== user.id
    && candidate.phone.replace(/\D/g, '') === normalizedDigits
  ));
  if (duplicate) {
    res.status(409).json({ ok: false, error: 'That phone number is already linked to another account.' });
    return;
  }

  user.displayName = nextDisplayName;
  user.country = nextCountry;
  user.avatar = nextAvatar;
  user.profileImage = nextProfileImageRaw || null;
  user.phone = nextPhone;
  userStore.set(user.id, user);
  persistDatabase();

  res.json(buildProfileResponse(user));
});

app.patch('/api/users/:userId/profile/phone', (req, res) => {
  const user = userStore.get(req.params.userId);
  const payload = (req.body ?? {}) as UpdatePhonePayload;

  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  const nextPhone = String(payload.phone ?? '').trim();
  const normalizedDigits = nextPhone.replace(/\D/g, '');
  if (normalizedDigits.length < 7 || normalizedDigits.length > 15) {
    res.status(400).json({ ok: false, error: 'Enter a valid phone number.' });
    return;
  }

  const duplicate = [...userStore.values()].find((candidate) => (
    candidate.id !== user.id
    && candidate.phone.replace(/\D/g, '') === normalizedDigits
  ));
  if (duplicate) {
    res.status(409).json({ ok: false, error: 'That phone number is already linked to another account.' });
    return;
  }

  user.phone = nextPhone;
  userStore.set(user.id, user);
  persistDatabase();

  res.json(buildProfileResponse(user));
});

app.patch('/api/users/:userId/profile/payout', async (req, res) => {
  const user = userStore.get(req.params.userId);
  const payload = (req.body ?? {}) as UpdatePayoutDetailsPayload;

  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  const bankCode = String(payload.bankCode ?? '').trim();
  const bankName = String(payload.bankName ?? '').trim();
  const accountNumber = String(payload.accountNumber ?? '').trim();
  const accountName = String(payload.accountName ?? '').trim();

  if (accountNumber.replace(/\D/g, '').length !== 10) {
    res.status(400).json({ ok: false, error: 'Enter a valid 10-digit account number.' });
    return;
  }

  try {
    let resolved: ResolvedBankAccount;
    if (isPaystackConfigured()) {
      if (!bankCode) {
        res.status(400).json({ ok: false, error: 'Select a bank before saving payout details.' });
        return;
      }
      resolved = await resolvePaystackBankAccount({
        bankCode,
        bankName,
        accountNumber: accountNumber.replace(/\D/g, '').slice(0, 10),
      });
    } else {
      if (!bankName || !accountName) {
        res.status(400).json({ ok: false, error: 'Enter the bank name and account name.' });
        return;
      }
      resolved = {
        bankCode,
        bankName,
        accountNumber: accountNumber.replace(/\D/g, '').slice(0, 10),
        accountName,
      };
    }

    user.payoutBankCode = resolved.bankCode || null;
    user.payoutBankName = resolved.bankName || null;
    user.payoutAccountNumber = resolved.accountNumber || null;
    user.payoutAccountName = resolved.accountName || null;
    userStore.set(user.id, user);
    persistDatabase();

    res.json(buildProfileResponse(user));
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Could not save payout details right now.' });
  }
});

app.get('/api/payments/config', (_req, res) => {
  res.json({
    ok: true,
    config: buildPaymentsConfig(),
  });
});

app.get('/api/payments/banks', async (_req, res) => {
  if (!isPaystackConfigured()) {
    res.status(503).json({ ok: false, error: 'Paystack is not configured on the server yet.' });
    return;
  }

  try {
    const banks = await listSupportedBanks();
    res.json({ ok: true, banks });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Could not load Nigerian banks right now.' });
  }
});

app.get('/api/payments/banks/resolve', async (req, res) => {
  if (!isPaystackConfigured()) {
    res.status(503).json({ ok: false, error: 'Paystack is not configured on the server yet.' });
    return;
  }

  const bankCode = String(req.query.bankCode ?? '').trim();
  const accountNumber = String(req.query.accountNumber ?? '').trim();
  const bankName = String(req.query.bankName ?? '').trim();
  if (!bankCode || accountNumber.length < 10) {
    res.status(400).json({ ok: false, error: 'Enter a valid bank and 10-digit account number.' });
    return;
  }

  try {
    const account = await resolvePaystackBankAccount({ bankCode, accountNumber, bankName });
    res.json({ ok: true, account });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Could not verify this bank account right now.' });
  }
});

app.post('/api/payments/deposit/initialize', async (req, res) => {
  if (!isPaystackConfigured()) {
    res.status(503).json({ ok: false, error: 'Paystack is not configured on the server yet.' });
    return;
  }

  const payload = req.body as WalletActionPayload;
  const user = requireUser(payload.userId);
  const amount = Number(payload.amount);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: 'Enter a valid deposit amount.' });
    return;
  }

  const reference = generatePaymentReference('dep');
  const payment = createPaymentRecord({
    kind: 'deposit',
    userId: user.id,
    amount: Number(amount.toFixed(2)),
    reference,
    status: 'pending',
    description: 'Wallet deposit via Paystack',
    metadata: {
      channel: 'inline_checkout',
    },
  });

  try {
    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL?.trim();
    const envelope = await paystackRequest<Record<string, unknown>>('/transaction/initialize', {
      method: 'POST',
      body: {
        email: user.email,
        amount: toKobo(amount),
        currency: 'NGN',
        reference,
        channels: PAYSTACK_CHANNELS,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: {
          userId: user.id,
          paymentId: payment.id,
          paymentKind: payment.kind,
        },
      },
    });

    const data = getRecord(envelope.data);
    updatePaymentRecord(payment, {
      status: 'processing',
      accessCode: getRecordText(data, 'access_code'),
      authorizationUrl: getRecordText(data, 'authorization_url'),
      providerTransactionId: getProviderTransactionId(data) ?? payment.providerTransactionId,
    });
    if (!payment.accessCode || !payment.authorizationUrl) {
      throw new Error('Paystack did not return an access code for this deposit.');
    }
    persistDatabase();

    res.json({
      ok: true,
      payment,
      accessCode: payment.accessCode,
      authorizationUrl: payment.authorizationUrl,
    });
  } catch (error) {
    failDepositPayment(payment, error instanceof Error ? error.message : 'Could not initialize this deposit.', 'failed');
    persistDatabase();
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Could not initialize this deposit.' });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  const payload = req.body as PaymentVerifyPayload;
  const user = requireUser(payload.userId);
  const reference = payload.reference?.trim();
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!reference) {
    res.status(400).json({ ok: false, error: 'Payment reference is required.' });
    return;
  }

  const payment = findPaymentByReference(reference, user.id);
  if (!payment) {
    res.status(404).json({ ok: false, error: 'Payment not found.' });
    return;
  }

  if (!isPaystackConfigured()) {
    res.json({
      ok: true,
      balance: user.balance,
      transactions: listTransactionsForUser(user.id),
      payment,
    });
    return;
  }

  try {
    await syncPaymentWithProvider(payment);
    persistDatabase();
    res.json({
      ok: true,
      balance: user.balance,
      transactions: listTransactionsForUser(user.id),
      payment,
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Could not verify this payment right now.' });
  }
});

app.post('/api/payments/sync', async (req, res) => {
  const payload = req.body as { userId?: string };
  const user = requireUser(payload.userId);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }

  if (isPaystackConfigured()) {
    const pendingPayments = paymentStore.filter((entry) => entry.userId === user.id && (entry.status === 'pending' || entry.status === 'processing'));
    for (const payment of pendingPayments) {
      try {
        await syncPaymentWithProvider(payment);
      } catch {
        // Leave the payment pending if Paystack is temporarily unavailable.
      }
    }
    persistDatabase();
  }

  res.json({
    ok: true,
    balance: user.balance,
    transactions: listTransactionsForUser(user.id),
    payments: listPaymentsForUser(user.id),
  });
});

app.post('/api/payments/withdrawals', async (req, res) => {
  if (!isPaystackConfigured()) {
    res.status(503).json({ ok: false, error: 'Paystack is not configured on the server yet.' });
    return;
  }

  const payload = req.body as WithdrawalRequestPayload;
  const user = requireUser(payload.userId);
  const amount = Number(payload.amount);
  const bankCode = payload.bankCode?.trim() ?? '';
  const bankName = payload.bankName?.trim() ?? '';
  const accountNumber = payload.accountNumber?.trim() ?? '';
  const accountName = payload.accountName?.trim() ?? '';

  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: 'Enter a valid withdrawal amount.' });
    return;
  }
  if (amount > user.balance) {
    res.status(400).json({ ok: false, error: 'Insufficient balance for this withdrawal.' });
    return;
  }
  if (!bankCode || accountNumber.length < 10) {
    res.status(400).json({ ok: false, error: 'Enter a valid Nigerian bank account.' });
    return;
  }

  const reference = generatePaymentReference('wdr');
  const payment = createPaymentRecord({
    kind: 'withdrawal',
    userId: user.id,
    amount: Number(amount.toFixed(2)),
    reference,
    status: 'pending',
    description: `Bank withdrawal to ${bankName || 'Nigerian bank'}`,
    bankCode,
    bankName: bankName || null,
    accountNumber,
    accountName: accountName || null,
  });

  try {
    const resolvedAccount = await resolvePaystackBankAccount({ bankCode, accountNumber, bankName });
    updatePaymentRecord(payment, {
      bankName: resolvedAccount.bankName,
      accountName: resolvedAccount.accountName,
    });

    const recipientEnvelope = await paystackRequest<Record<string, unknown>>('/transferrecipient', {
      method: 'POST',
      body: {
        type: 'nuban',
        name: resolvedAccount.accountName,
        account_number: resolvedAccount.accountNumber,
        bank_code: resolvedAccount.bankCode,
        currency: 'NGN',
      },
    });
    const recipientData = getRecord(recipientEnvelope.data);
    const recipientCode = getRecordText(recipientData, 'recipient_code');
    if (!recipientCode) {
      throw new Error('Paystack did not return a transfer recipient code.');
    }

    updatePaymentRecord(payment, {
      transferRecipientCode: recipientCode,
      status: 'processing',
    });

    const transferEnvelope = await paystackRequest<Record<string, unknown>>('/transfer', {
      method: 'POST',
      body: {
        source: 'balance',
        amount: toKobo(amount),
        recipient: recipientCode,
        reference,
        reason: `Withdrawal for ${user.username}`,
      },
    });
    const transferData = getRecord(transferEnvelope.data);
    const providerStatus = getRecordText(transferData, 'status');
    if (providerStatus === 'otp') {
      failWithdrawalPayment(payment, 'This Paystack account still requires OTP approval for transfers. Disable transfer OTP in Paystack test mode first.', 'failed');
      persistDatabase();
      res.status(409).json({ ok: false, error: 'Paystack transfer OTP is still enabled. Disable transfer OTP in your Paystack test dashboard, then try again.' });
      return;
    }

    const reservedTx = reserveWithdrawalBalance(user, amount, `Withdrawal to ${resolvedAccount.bankName} • ${resolvedAccount.accountNumber}`);
    user.payoutBankCode = resolvedAccount.bankCode;
    user.payoutBankName = resolvedAccount.bankName;
    user.payoutAccountNumber = resolvedAccount.accountNumber;
    user.payoutAccountName = resolvedAccount.accountName;
    userStore.set(user.id, user);
    updatePaymentRecord(payment, {
      walletTransactionId: reservedTx.id,
      providerTransactionId: getProviderTransactionId(transferData) ?? payment.providerTransactionId,
      metadata: mergePaymentMetadata(payment, {
        providerStatus,
      }),
    });

    const status = normalizeProviderStatus('withdrawal', providerStatus);
    if (status === 'completed') {
      completeWithdrawalPayment(payment, transferData);
    } else if (status === 'failed') {
      failWithdrawalPayment(payment, transferEnvelope.message || 'Withdrawal was not completed.', 'failed');
    } else {
      updatePaymentRecord(payment, { status });
    }

    persistDatabase();
    res.json({
      ok: true,
      balance: user.balance,
      transactions: listTransactionsForUser(user.id),
      payment,
    });
  } catch (error) {
    failWithdrawalPayment(payment, error instanceof Error ? error.message : 'Could not submit this withdrawal.', 'failed');
    persistDatabase();
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Could not submit this withdrawal.' });
  }
});

app.post('/api/wallet/deposit', (req, res) => {
  const payload = req.body as WalletActionPayload;
  const user = requireUser(payload.userId);
  const amount = Number(payload.amount);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: 'Enter a valid deposit amount.' });
    return;
  }

  applyWalletMutation(user, {
    amount,
    type: 'deposit',
    description: payload.description?.trim() || 'Demo deposit',
  });
  persistDatabase();

  res.json({
    ok: true,
    balance: user.balance,
    transactions: walletStore
      .filter((entry) => entry.userId === user.id)
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, 8)
      .map(({ userId: _userId, balanceAfter: _balanceAfter, ...entry }) => entry),
  });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const payload = req.body as WalletActionPayload;
  const user = requireUser(payload.userId);
  const amount = Number(payload.amount);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: 'Enter a valid withdrawal amount.' });
    return;
  }
  if (amount > user.balance) {
    res.status(400).json({ ok: false, error: 'Insufficient balance for this withdrawal.' });
    return;
  }

  applyWalletMutation(user, {
    amount: -amount,
    type: 'withdrawal',
    description: payload.description?.trim() || 'Bank withdrawal',
    status: 'pending',
  });
  persistDatabase();

  res.json({
    ok: true,
    balance: user.balance,
    transactions: walletStore
      .filter((entry) => entry.userId === user.id)
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, 8)
      .map(({ userId: _userId, balanceAfter: _balanceAfter, ...entry }) => entry),
  });
});

app.post('/api/matches/record', (req, res) => {
  const payload = req.body as RecordMatchPayload;
  const user = requireUser(payload.userId);
  if (!user) {
    res.status(404).json({ ok: false, error: 'User not found.' });
    return;
  }
  if (!payload.game || !payload.result || !payload.score) {
    res.status(400).json({ ok: false, error: 'Match details are incomplete.' });
    return;
  }
  const stake = Number(payload.stake ?? 0);
  const payout = Number(payload.payout ?? 0);
  if (!Number.isFinite(stake) || stake < 0 || !Number.isFinite(payout) || payout < 0) {
    res.status(400).json({ ok: false, error: 'Stake and payout must be valid positive numbers.' });
    return;
  }

  recordMatchForUser(user, {
    game: payload.game,
    result: payload.result,
    score: payload.score,
    stake,
    payout,
    opponentName: payload.opponentName,
    opponentAvatar: payload.opponentAvatar,
    closingBalance: payload.closingBalance,
  });
  persistDatabase();

  res.json({
    ok: true,
    balance: user.balance,
  });
});

app.get('/api/admin/overview', (req, res) => {
  const viewer = requireAdmin(typeof req.query.userId === 'string' ? req.query.userId : undefined);
  if (!viewer) {
    res.status(403).json({ ok: false, error: 'Admin access is required.' });
    return;
  }

  res.json({
    ok: true,
    overview: buildAdminOverviewSnapshot({
      users: [...userStore.values()],
      walletTransactions: walletStore,
      matchRecords: matchStore,
      referralRecords: referralStore,
      onlineUserIds: new Set(presenceStore.keys()),
    }),
    viewer: toPublicUser(viewer),
  });
});

app.get('/api/tournaments', (_req, res) => {
  res.json({
    ok: true,
    tournaments: listTournamentsFor(),
  });
});

app.post('/api/tournaments', (req, res) => {
  const payload = req.body as CreateTournamentPayload;
  if (!payload.creator || !payload.game) {
    res.status(400).json({ ok: false, error: 'Tournament creator and game are required.' });
    return;
  }
  const title = payload.title?.trim() ?? '';
  const maxPlayers = Number(payload.maxPlayers);
  const game = payload.game;
  const allowedSizes = game === 'ludo' ? [4, 8, 16] : [4, 8, 16, 32];
  if (!title) {
    res.status(400).json({ ok: false, error: 'Give the tournament a title.' });
    return;
  }
  if (!allowedSizes.includes(maxPlayers)) {
    res.status(400).json({ ok: false, error: `Choose a supported bracket size: ${allowedSizes.join(', ')}.` });
    return;
  }

  const tournament = createTournamentFromPayload(payload);
  tournamentStore.set(tournament.id, tournament);
  persistDatabase();
  res.json({ ok: true, tournament });
});

app.post('/api/tournaments/:tournamentId/join', (req, res) => {
  const tournament = tournamentStore.get(req.params.tournamentId);
  const payload = req.body as JoinTournamentPayload;
  if (!tournament) {
    res.status(404).json({ ok: false, error: 'Tournament not found.' });
    return;
  }
  if (tournament.status !== 'open') {
    res.status(400).json({ ok: false, error: 'This tournament is no longer accepting players.' });
    return;
  }
  if (!payload.user?.id || !payload.user.name || !payload.user.avatar) {
    res.status(400).json({ ok: false, error: 'Player details are incomplete.' });
    return;
  }
  if (tournament.participants.some((participant) => participant.id === payload.user!.id)) {
    res.json({ ok: true, tournament });
    return;
  }
  if (tournament.participants.length >= tournament.maxPlayers) {
    res.status(400).json({ ok: false, error: 'All tournament seats are filled.' });
    return;
  }

  const nextTournament = cloneTournament(tournament);
  nextTournament.participants.push(toTournamentParticipant(payload.user));
  maybeStartTournament(nextTournament);
  tournamentStore.set(nextTournament.id, nextTournament);
  persistDatabase();
  res.json({ ok: true, tournament: nextTournament });
});

app.post('/api/tournaments/:tournamentId/matches/:matchId/report', (req, res) => {
  const tournament = tournamentStore.get(req.params.tournamentId);
  const payload = req.body as ReportTournamentWinnerPayload;
  if (!tournament) {
    res.status(404).json({ ok: false, error: 'Tournament not found.' });
    return;
  }

  const nextTournament = cloneTournament(tournament);
  const round = nextTournament.rounds.find((entry) => entry.matches.some((match) => match.id === req.params.matchId));
  const match = round?.matches.find((entry) => entry.id === req.params.matchId);
  if (!round || !match) {
    res.status(404).json({ ok: false, error: 'Tournament match not found.' });
    return;
  }
  if (!payload.winnerUserId || !payload.actingUserId) {
    res.status(400).json({ ok: false, error: 'Winner and acting player are required.' });
    return;
  }
  const actingAllowed = nextTournament.creator.id === payload.actingUserId || match.participants.some((participant) => participant.id === payload.actingUserId);
  if (!actingAllowed) {
    res.status(403).json({ ok: false, error: 'Only the host or current match players can report a winner.' });
    return;
  }
  if (!match.participants.some((participant) => participant.id === payload.winnerUserId)) {
    res.status(400).json({ ok: false, error: 'Winner must belong to this match.' });
    return;
  }

  match.winnerUserId = payload.winnerUserId;
  match.status = 'finished';
  if (match.challenge) {
    match.challenge.status = 'finished';
    challengeStore.set(match.challenge.id, match.challenge);
    if (match.challenge.roomId) {
      const room = roomStore.get(match.challenge.roomId);
      if (room) {
        room.state = 'finished';
        roomStore.set(room.roomId, room);
      }
    }
  }

  advanceTournamentBracket(nextTournament);
  tournamentStore.set(nextTournament.id, nextTournament);
  persistDatabase();
  res.json({ ok: true, tournament: nextTournament });
});

app.get('/api/challenges', (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  res.json(listChallengesFor(userId));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by Socket.IO.`), false);
    },
  },
});

io.on('connection', (socket) => {
  socket.on('player:identify', (user: PlayerIdentity, ack?: (payload: { ok: true }) => void) => {
    const previousUserId = socket.data.user?.id as string | undefined;
    if (previousUserId && previousUserId !== user.id) {
      setUserPresence(previousUserId, -1);
    }
    socket.data.user = user;
    socket.join(`user:${user.id}`);
    setUserPresence(user.id, 1);
    ack?.({ ok: true });
  });

  socket.on('challenge:list', (_payload: undefined, ack?: (payload: Challenge[]) => void) => {
    const userId = socket.data.user?.id as string | undefined;
    ack?.(listChallengesFor(userId));
  });

  socket.on('challenge:create', (payload: CreateChallengePayload, ack?: (payload: { ok: boolean; challenge?: Challenge; error?: string }) => void) => {
    const createdAt = new Date().toISOString();
    const seats = challengeSeats(payload as Challenge);
    const roomId = defaultRoomId(payload.id);
    const participants = (payload.game === 'ludo' || payload.inviteScope === 'private')
      ? [participantFromUser({
          id: payload.creator.id,
          name: payload.creator.name,
          avatar: payload.creator.avatar,
          rating: payload.creator.rating,
        }, 0)]
      : undefined;

    const challenge: Challenge = {
      ...payload,
      createdAt,
      roomId,
      participants,
      seatsFilled: participants?.length,
      seats: payload.game === 'ludo' ? seats : payload.seats,
      status: 'open',
    };

    challengeStore.set(challenge.id, challenge);
    const room = ensureRoomForChallenge(challenge);
    persistDatabase();
    emitChallenge(io, challenge);
    const inviteTargets = new Set<string>();
    if (challenge.invitedUserId) inviteTargets.add(challenge.invitedUserId);
    challenge.invitedUsers?.forEach((invite) => {
      if (invite.id) inviteTargets.add(invite.id);
    });
    inviteTargets.forEach((inviteeId) => {
      io.to(`user:${inviteeId}`).emit('invite:received', challenge);
    });
    ack?.({ ok: true, challenge });
  });

  socket.on('challenge:accept', (payload: AcceptChallengePayload, ack?: (payload: { ok: boolean; challenge?: Challenge; roomState?: ChallengeRoomState; error?: string }) => void) => {
    const challenge = challengeStore.get(payload.challengeId);
    if (!challenge) {
      ack?.({ ok: false, error: 'Challenge not found.' });
      return;
    }

    const seats = challengeSeats(challenge);
    const nextParticipants = [...(challenge.participants ?? [])];
    const existing = nextParticipants.find((participant) => participant.id === payload.user.id);
    if (!existing) {
      if (nextParticipants.length >= seats) {
        ack?.({ ok: false, error: 'All seats are filled.' });
        return;
      }
      nextParticipants.push(participantFromUser(payload.user, nextParticipants.length));
    }

    const updated: Challenge = {
      ...challenge,
      participants: nextParticipants,
      seatsFilled: nextParticipants.length,
      status: nextParticipants.length >= seats ? 'filled' : 'open',
    };

    challengeStore.set(updated.id, updated);
    const room = ensureRoomForChallenge(updated);
    if (room) {
      room.participants = nextParticipants;
      room.state = nextParticipants.length >= room.seats ? 'ready' : 'waiting';
      roomStore.set(room.roomId, room);
      socket.join(room.roomId);
      emitRoom(io, room);
    }

    persistDatabase();
    emitChallenge(io, updated);
    ack?.({ ok: true, challenge: updated, roomState: room ?? undefined });
  });

  socket.on('room:join', (payload: JoinRoomPayload, ack?: (payload: { ok: boolean; roomState?: ChallengeRoomState; error?: string }) => void) => {
    const socketUserId = socket.data.user?.id as string | undefined;
    const access = roomAccessFor(payload.roomId, socketUserId);
    if (!access.room || access.error) {
      ack?.({ ok: false, error: access.error || 'Room not found.' });
      return;
    }
    const room = access.room;
    socket.join(room.roomId);
    ack?.({ ok: true, roomState: room });
    emitRoom(io, room);
    const liveMatch = ludoStore.get(room.roomId);
    if (liveMatch) {
      socket.emit('ludo:state', liveMatch);
    }
  });

  socket.on('room:spectate', (payload: JoinRoomPayload, ack?: (payload: { ok: boolean; roomState?: ChallengeRoomState; error?: string }) => void) => {
    const socketUserId = socket.data.user?.id as string | undefined;
    const access = roomAccessFor(payload.roomId, socketUserId);
    if (!access.room || access.error) {
      ack?.({ ok: false, error: access.error || 'Room not found.' });
      return;
    }

    const room = access.room;
    const isPlayer = room.participants.some((participant) => participant.id === payload.user.id);
    if (!isPlayer) {
      const existingSpectators = room.spectators ?? [];
      if (!existingSpectators.some((spectator) => spectator.id === payload.user.id)) {
        room.spectators = [
          ...existingSpectators,
          {
            id: payload.user.id,
            name: payload.user.name,
            avatar: payload.user.avatar,
            rating: payload.user.rating,
            supportTargetUserId: null,
          },
        ];
      }
      roomStore.set(room.roomId, room);
    }

    socket.join(room.roomId);
    emitRoom(io, room);
    ack?.({ ok: true, roomState: room });
  });

  socket.on('chat:list', (payload: RoomScopedPayload, ack?: (payload: { ok: boolean; messages?: RoomChatMessage[]; error?: string }) => void) => {
    const socketUserId = socket.data.user?.id as string | undefined;
    const access = roomAccessFor(payload.roomId, socketUserId);
    if (!access.room || access.error) {
      ack?.({ ok: false, error: access.error || 'Room not found.' });
      return;
    }
    socket.join(access.room.roomId);
    ack?.({ ok: true, messages: listRoomMessages(access.room.roomId) });
  });

  socket.on('room:support', (payload: RoomSupportPayload, ack?: (payload: { ok: boolean; roomState?: ChallengeRoomState; error?: string }) => void) => {
    const access = roomAccessFor(payload.roomId, payload.userId);
    if (!access.room || access.error) {
      ack?.({ ok: false, error: access.error || 'Room not found.' });
      return;
    }

    const room = access.room;
    if (payload.targetUserId && !room.participants.some((participant) => participant.id === payload.targetUserId)) {
      ack?.({ ok: false, error: 'Support target is not seated in this room.' });
      return;
    }

    const nextSpectators = [...(room.spectators ?? [])];
    const existingIndex = nextSpectators.findIndex((spectator) => spectator.id === payload.userId);
    if (existingIndex === -1) {
      const sourceUser = socket.data.user as PlayerIdentity | undefined;
      if (!sourceUser) {
        ack?.({ ok: false, error: 'Identify this viewer before supporting a player.' });
        return;
      }
      nextSpectators.push({
        id: sourceUser.id,
        name: sourceUser.name,
        avatar: sourceUser.avatar,
        rating: sourceUser.rating,
        supportTargetUserId: payload.targetUserId ?? null,
      });
    } else {
      nextSpectators[existingIndex] = {
        ...nextSpectators[existingIndex],
        supportTargetUserId: payload.targetUserId ?? null,
      };
    }

    room.spectators = nextSpectators;
    roomStore.set(room.roomId, room);
    emitRoom(io, room);
    ack?.({ ok: true, roomState: room });
  });

  socket.on('chat:send', (payload: ChatSendPayload, ack?: (payload: { ok: boolean; message?: RoomChatMessage; error?: string }) => void) => {
    const sender = socket.data.user as PlayerIdentity | undefined;
    if (!sender) {
      ack?.({ ok: false, error: 'Identify this player before chatting.' });
      return;
    }

    const access = roomAccessFor(payload.roomId, sender.id);
    if (!access.room || access.error) {
      ack?.({ ok: false, error: access.error || 'Room not found.' });
      return;
    }

    const text = payload.text?.trim();
    if (!text) {
      ack?.({ ok: false, error: 'Type a message before sending.' });
      return;
    }

    const message = appendRoomMessage(access.room.roomId, {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId: access.room.roomId,
      text: text.slice(0, 280),
      sentAt: new Date().toISOString(),
      sender: {
        id: sender.id,
        name: sender.name,
        avatar: sender.avatar,
        rating: sender.rating,
      },
    });

    socket.join(access.room.roomId);
    emitRoomChat(io, message);
    ack?.({ ok: true, message });
  });

  socket.on('room:ready', (payload: ReadyPayload, ack?: (payload: { ok: boolean; roomState?: ChallengeRoomState; error?: string }) => void) => {
    const room = roomStore.get(payload.roomId);
    if (!room) {
      ack?.({ ok: false, error: 'Room not found.' });
      return;
    }
    room.participants = room.participants.map((participant) => participant.id === payload.userId ? { ...participant, ready: payload.ready } : participant);
    const everyoneReady = room.participants.length >= room.seats && room.participants.every((participant) => participant.ready);
    room.state = everyoneReady ? 'ready' : 'waiting';
    syncChallengeAndRoomState(io, room, everyoneReady ? 'filled' : 'open');
    ack?.({ ok: true, roomState: room });
  });

  socket.on('ludo:start', (payload: StartLudoPayload, ack?: (payload: { ok: boolean; match?: LudoMatchState; error?: string }) => void) => {
    const room = roomStore.get(payload.roomId);
    const socketUserId = socket.data.user?.id as string | undefined;
    if (!room || room.game !== 'ludo') {
      ack?.({ ok: false, error: 'Ludo room not found.' });
      return;
    }
    if (!socketUserId || socketUserId !== payload.userId) {
      ack?.({ ok: false, error: 'Identify this player before starting the room.' });
      return;
    }
    if (!room.participants.some((participant) => participant.id === payload.userId)) {
      ack?.({ ok: false, error: 'You do not have a seat in this room.' });
      return;
    }
    if (room.participants.length < room.seats) {
      ack?.({ ok: false, error: 'Every seat must be filled before the match can start.' });
      return;
    }
    if (!room.participants.every((participant) => participant.ready)) {
      ack?.({ ok: false, error: 'Everyone must mark ready before the match can start.' });
      return;
    }

    const existing = ludoStore.get(room.roomId);
    if (existing) {
      socket.join(room.roomId);
      ack?.({ ok: true, match: existing });
      emitLudo(io, existing);
      return;
    }

    const challenge = challengeStore.get(room.challengeId);
    const match = createLudoMatchState({
      roomId: room.roomId,
      challengeId: room.challengeId,
      seats: room.seats,
      participants: room.participants,
      activeStake: challenge?.stake ?? Math.max(0, Number(payload.stake) || 0),
    });

    ludoStore.set(room.roomId, match);
    room.state = 'in_progress';
    socket.join(room.roomId);
    syncChallengeAndRoomState(io, room, 'in_progress');
    updateTournamentMatchStateFromChallenge(room.challengeId, 'in_progress');
    ack?.({ ok: true, match });
    emitLudo(io, match);
  });

  socket.on('ludo:roll', (payload: LudoRollPayload, ack?: (payload: { ok: boolean; match?: LudoMatchState; error?: string }) => void) => {
    const socketUserId = socket.data.user?.id as string | undefined;
    if (!socketUserId || socketUserId !== payload.userId) {
      ack?.({ ok: false, error: 'Identify this player before rolling.' });
      return;
    }

    const current = ludoStore.get(payload.roomId);
    if (!current) {
      ack?.({ ok: false, error: 'No live Ludo match was found for this room.' });
      return;
    }

    try {
      const rolledValue = 1 + Math.floor(Math.random() * 6);
      const nextMatch = rollLudoMatch(current, payload.userId, rolledValue);
      ludoStore.set(payload.roomId, nextMatch);
      ack?.({ ok: true, match: nextMatch });
      emitLudo(io, nextMatch);
    } catch (error) {
      ack?.({ ok: false, error: error instanceof Error ? error.message : 'Unable to roll right now.' });
    }
  });

  socket.on('ludo:move', (payload: LudoMovePayload, ack?: (payload: { ok: boolean; match?: LudoMatchState; error?: string }) => void) => {
    const socketUserId = socket.data.user?.id as string | undefined;
    if (!socketUserId || socketUserId !== payload.userId) {
      ack?.({ ok: false, error: 'Identify this player before moving.' });
      return;
    }

    const current = ludoStore.get(payload.roomId);
    if (!current) {
      ack?.({ ok: false, error: 'No live Ludo match was found for this room.' });
      return;
    }

    try {
      const nextMatch = moveLudoMatch(current, payload.userId, payload.laneId, payload.tokenId);
      ludoStore.set(payload.roomId, nextMatch);

      const room = roomStore.get(payload.roomId);
      if (room) {
        room.state = nextMatch.phase === 'finished' ? 'finished' : 'in_progress';
        syncChallengeAndRoomState(io, room, nextMatch.phase === 'finished' ? 'finished' : 'in_progress');
        updateTournamentMatchStateFromChallenge(
          room.challengeId,
          nextMatch.phase === 'finished' ? 'finished' : 'in_progress',
          nextMatch.phase === 'finished' ? nextMatch.winnerOwnerId : undefined,
        );
      }

      ack?.({ ok: true, match: nextMatch });
      emitLudo(io, nextMatch);
    } catch (error) {
      ack?.({ ok: false, error: error instanceof Error ? error.message : 'Unable to move that token.' });
    }
  });

  socket.on('disconnect', () => {
    const userId = socket.data.user?.id as string | undefined;
    if (!userId) return;
    setUserPresence(userId, -1);
  });
});

const port = Number(process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`Realtime server listening on http://localhost:${port}`);
});
