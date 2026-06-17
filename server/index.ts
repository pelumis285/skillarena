import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { createLudoMatchState, moveLudoMatch, rollLudoMatch } from '../src/lib/ludoEngine.ts';
import { mockChallenges } from '../src/lib/mock.ts';
import type { Challenge, ChallengeParticipant, ChallengeRoomState, GameId, LudoMatchState, LudoSeats } from '../src/lib/types.ts';
import { createStoredUser, loadDatabase, saveDatabase, toPublicUser, verifyPassword, type StoredUser } from './store.ts';

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

type RegisterPayload = {
  email?: string;
  username?: string;
  password?: string;
  displayName?: string;
  avatar?: string;
};

type LoginPayload = {
  email?: string;
  password?: string;
};

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
  };
}

function isVisibleToUser(challenge: Challenge, userId?: string) {
  if (challenge.inviteScope !== 'private') return true;
  if (!userId) return false;
  const invitedIds = challenge.invitedUsers?.map((invite) => invite.id).filter(Boolean) ?? [];
  return challenge.creator.id === userId || challenge.invitedUserId === userId || invitedIds.includes(userId) || challenge.participants?.some((participant) => participant.id === userId);
}

function buildSeedChallenges(source: Challenge[]) {
  return source.map((challenge) => {
    const normalized: Challenge = {
      ...challenge,
      roomId: challenge.roomId ?? (challenge.game === 'ludo' ? `room-${challenge.id}` : undefined),
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

const database = loadDatabase();
const userStore = new Map<string, StoredUser>(database.users.map((user) => [user.id, user]));
const challengeStore = new Map<string, Challenge>(buildSeedChallenges(database.challenges.length ? database.challenges : mockChallenges).map((challenge) => [challenge.id, challenge]));
const roomStore = new Map<string, ChallengeRoomState>();
const ludoStore = new Map<string, LudoMatchState>();
const presenceStore = new Map<string, number>();

for (const challenge of challengeStore.values()) {
  const roomState = roomStateFromChallenge(challenge);
  if (roomState) roomStore.set(roomState.roomId, roomState);
}

function persistDatabase() {
  saveDatabase({
    users: [...userStore.values()],
    challenges: [...challengeStore.values()],
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
    .filter((challenge) => isVisibleToUser(challenge, userId))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function emitChallenge(io: Server, challenge: Challenge) {
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

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    users: userStore.size,
    onlineUsers: presenceStore.size,
    rooms: roomStore.size,
    challenges: challengeStore.size,
    time: new Date().toISOString(),
  });
});

app.post('/api/auth/register', (req, res) => {
  const payload = req.body as RegisterPayload;
  const email = payload.email?.trim().toLowerCase() ?? '';
  const username = payload.username?.trim().toLowerCase() ?? '';
  const password = payload.password?.trim() ?? '';
  const displayName = payload.displayName?.trim() ?? '';
  const avatar = payload.avatar?.trim() ?? '';

  if (!email || !username || !password || !displayName || !avatar) {
    res.status(400).json({ ok: false, error: 'Complete every registration field.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
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

  const user = createStoredUser({
    email,
    username,
    password,
    displayName,
    avatar,
  });

  userStore.set(user.id, user);
  persistDatabase();

  res.json({
    ok: true,
    user: toPublicUser(user),
    balance: user.balance,
  });
});

app.post('/api/auth/login', (req, res) => {
  const payload = req.body as LoginPayload;
  const email = payload.email?.trim().toLowerCase() ?? '';
  const password = payload.password?.trim() ?? '';
  const user = [...userStore.values()].find((candidate) => candidate.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
    return;
  }

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

app.get('/api/challenges', (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  res.json(listChallengesFor(userId));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
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
    const roomId = payload.game === 'ludo' || payload.inviteScope === 'private' ? `room-${payload.id}` : undefined;
    const participants = roomId
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
    const room = roomStore.get(payload.roomId);
    if (!room) {
      ack?.({ ok: false, error: 'Room not found.' });
      return;
    }
    socket.join(room.roomId);
    ack?.({ ok: true, roomState: room });
    emitRoom(io, room);
    const liveMatch = ludoStore.get(room.roomId);
    if (liveMatch) {
      socket.emit('ludo:state', liveMatch);
    }
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
