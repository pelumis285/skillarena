import type {
  ChallengeParticipant,
  LudoMatchPlayer,
  LudoMatchState,
  LudoSeats,
  LudoToken,
  PlayerColor,
  PlayerKind,
} from './types';

export type MovableTokenRef = { playerIndex: number; tokenIndex: number };

export type LaneOwner = {
  id: string;
  name: string;
  avatar: string;
  rating?: number;
  kind: PlayerKind;
};

export const GRID_SIZE = 15;
export const TRACK_LENGTH = 52;
export const HOME_LENGTH = 6;
export const FINISH_PROGRESS = TRACK_LENGTH + HOME_LENGTH;
export const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const TRACK_COORDS: Array<[number, number]> = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6],
];
export const FINISH_SLOTS: Array<[number, number]> = [[6.55, 6.55], [7.45, 6.55], [6.55, 7.45], [7.45, 7.45]];

export const LUDO_COLOR_META: Record<PlayerColor, {
  label: string;
  startIndex: number;
  homePath: Array<[number, number]>;
  baseSlots: Array<[number, number]>;
  baseArea: { rows: [number, number]; cols: [number, number] };
}> = {
  green: {
    label: 'Green',
    startIndex: 0,
    homePath: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
    baseSlots: [[2.18, 2.18], [3.82, 2.18], [2.18, 3.82], [3.82, 3.82]],
    baseArea: { rows: [0, 5], cols: [0, 5] },
  },
  yellow: {
    label: 'Yellow',
    startIndex: 13,
    homePath: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
    baseSlots: [[10.18, 2.18], [11.82, 2.18], [10.18, 3.82], [11.82, 3.82]],
    baseArea: { rows: [0, 5], cols: [9, 14] },
  },
  red: {
    label: 'Red',
    startIndex: 39,
    homePath: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
    baseSlots: [[2.18, 10.18], [3.82, 10.18], [2.18, 11.82], [3.82, 11.82]],
    baseArea: { rows: [9, 14], cols: [0, 5] },
  },
  blue: {
    label: 'Blue',
    startIndex: 26,
    homePath: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
    baseSlots: [[10.18, 10.18], [11.82, 10.18], [10.18, 11.82], [11.82, 11.82]],
    baseArea: { rows: [9, 14], cols: [9, 14] },
  },
};

const STACK_OFFSETS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-0.11, 0], [0.11, 0]],
  3: [[0, -0.11], [-0.1, 0.1], [0.1, 0.1]],
  4: [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]],
};

const FOUR_PLAYER_COLOR_ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export function makeTokens(): LudoToken[] {
  return Array.from({ length: 4 }, (_, id) => ({ id, progress: -1, finished: false }));
}

export function buildLane(owner: LaneOwner, color: PlayerColor): LudoMatchPlayer {
  return {
    laneId: `${owner.id}-${color}`,
    ownerId: owner.id,
    id: owner.id,
    name: owner.name,
    avatar: owner.avatar,
    rating: owner.rating,
    color,
    kind: owner.kind,
    tokens: makeTokens(),
  };
}

export function clonePlayers(players: LudoMatchPlayer[]) {
  return players.map((player) => ({
    ...player,
    tokens: player.tokens.map((token) => ({ ...token })),
  }));
}

export function getMovableTokenIndexes(player: LudoMatchPlayer, dice: number) {
  return player.tokens
    .map((token, index) => {
      if (token.finished) return null;
      if (token.progress === -1) return dice === 6 ? index : null;
      const next = token.progress + dice;
      if (next > FINISH_PROGRESS) return null;
      return index;
    })
    .filter((value): value is number => value !== null);
}

export function getMovableTokenRefs(players: LudoMatchPlayer[], ownerId: string, dice: number): MovableTokenRef[] {
  return players.flatMap((player, playerIndex) => (
    player.ownerId === ownerId
      ? getMovableTokenIndexes(player, dice).map((tokenIndex) => ({ playerIndex, tokenIndex }))
      : []
  ));
}

export function ownerIdsInOrder(players: LudoMatchPlayer[]) {
  const ownerIds: string[] = [];
  players.forEach((player) => {
    if (!ownerIds.includes(player.ownerId)) ownerIds.push(player.ownerId);
  });
  return ownerIds;
}

export function ownerNameFor(players: LudoMatchPlayer[], ownerId: string) {
  return players.find((player) => player.ownerId === ownerId)?.name ?? 'Opponent';
}

export function ownerBaseCount(players: LudoMatchPlayer[], ownerId: string) {
  return players
    .filter((player) => player.ownerId === ownerId)
    .reduce((total, player) => total + player.tokens.filter((token) => token.progress === -1).length, 0);
}

export function ownerHomeCount(players: LudoMatchPlayer[], ownerId: string) {
  return players
    .filter((player) => player.ownerId === ownerId)
    .reduce((total, player) => total + player.tokens.filter((token) => token.finished).length, 0);
}

export function ownerTokenTargetCount(players: LudoMatchPlayer[], ownerId: string) {
  return players.filter((player) => player.ownerId === ownerId).length * 4;
}

export function isOwnerFinished(players: LudoMatchPlayer[], ownerId: string) {
  return players
    .filter((player) => player.ownerId === ownerId)
    .every((player) => player.tokens.every((token) => token.finished));
}

export function boardIndexFor(player: LudoMatchPlayer, token: LudoToken) {
  if (token.progress < 0 || token.progress >= TRACK_LENGTH) return null;
  return (LUDO_COLOR_META[player.color].startIndex + token.progress) % TRACK_LENGTH;
}

export function projectedProgress(token: LudoToken, dice: number) {
  if (token.finished) return null;
  if (token.progress === -1) return dice === 6 ? 0 : null;
  const next = token.progress + dice;
  if (next > FINISH_PROGRESS) return null;
  return next;
}

export function projectedBoardIndex(player: LudoMatchPlayer, token: LudoToken, dice: number) {
  const nextProgress = projectedProgress(token, dice);
  if (nextProgress === null || nextProgress >= TRACK_LENGTH) return null;
  return (LUDO_COLOR_META[player.color].startIndex + nextProgress) % TRACK_LENGTH;
}

export function findOpponentTokenOnSquare(players: LudoMatchPlayer[], activeOwnerId: string, boardIndex: number) {
  for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
    const opponent = players[playerIndex];
    if (opponent.ownerId === activeOwnerId) continue;

    for (let tokenIndex = 0; tokenIndex < opponent.tokens.length; tokenIndex += 1) {
      const opponentToken = opponent.tokens[tokenIndex];
      if (opponentToken.finished) continue;
      if (boardIndexFor(opponent, opponentToken) === boardIndex) {
        return { playerIndex, tokenIndex };
      }
    }
  }

  return null;
}

export function countOpponentsOnSquare(players: LudoMatchPlayer[], activeOwnerId: string, boardIndex: number) {
  return findOpponentTokenOnSquare(players, activeOwnerId, boardIndex) ? 1 : 0;
}

export function isThreatenedSquare(players: LudoMatchPlayer[], activeOwnerId: string, boardIndex: number) {
  return players.some((opponent) => {
    if (opponent.ownerId === activeOwnerId) return false;
    return opponent.tokens.some((token) => {
      const opponentBoard = boardIndexFor(opponent, token);
      if (opponentBoard === null) return false;
      const stepsNeeded = (boardIndex - opponentBoard + TRACK_LENGTH) % TRACK_LENGTH;
      return stepsNeeded > 0 && stepsNeeded <= 6;
    });
  });
}

export function scoreBotMove(players: LudoMatchPlayer[], playerIndex: number, tokenIndex: number, dice: number) {
  const player = players[playerIndex];
  const token = player.tokens[tokenIndex];
  const nextProgress = projectedProgress(token, dice);
  if (nextProgress === null) return Number.NEGATIVE_INFINITY;

  const activeOwnerId = player.ownerId;
  const currentBoard = boardIndexFor(player, token);
  const nextBoard = projectedBoardIndex(player, token, dice);
  const captures = nextBoard === null ? 0 : countOpponentsOnSquare(players, activeOwnerId, nextBoard);
  const entersTrack = token.progress === -1 && nextProgress === 0;
  const entersHomeLane = token.progress >= 0 && token.progress < TRACK_LENGTH && nextProgress >= TRACK_LENGTH;
  const finishes = nextProgress === FINISH_PROGRESS;
  const wasThreatened = currentBoard !== null && isThreatenedSquare(players, activeOwnerId, currentBoard);
  const willBeThreatened = nextBoard !== null && isThreatenedSquare(players, activeOwnerId, nextBoard);
  const piecesInBase = player.tokens.filter((piece) => piece.progress === -1).length;

  let score = nextProgress;
  if (captures) score += 110 + captures * 18;
  if (finishes) score += 160;
  if (entersHomeLane) score += 40;
  if (entersTrack) score += piecesInBase > 2 ? 34 : 24;
  if (wasThreatened && !willBeThreatened) score += 26;
  if (!wasThreatened && willBeThreatened) score -= 22;
  if (nextBoard !== null && SAFE_TRACK_INDEXES.has(nextBoard)) score += 8;
  if (token.progress > 0) score += Math.min(token.progress, 24) * 0.7;
  if (token.progress === -1 && player.tokens.some((piece, index) => index !== tokenIndex && piece.progress === -1)) score += 6;
  if (nextBoard !== null && currentBoard !== null && nextBoard === currentBoard) score -= 12;

  return score;
}

export function stackOffsetFor(player: LudoMatchPlayer, token: LudoToken): [number, number] {
  if (token.progress < 0 || token.finished) return [0, 0];

  const stack = player.tokens
    .filter((piece) => !piece.finished && piece.progress === token.progress)
    .sort((left, right) => left.id - right.id);

  const layout = STACK_OFFSETS[Math.min(stack.length, 4)] ?? STACK_OFFSETS[1];
  const stackIndex = stack.findIndex((piece) => piece.id === token.id);
  return layout[Math.max(0, stackIndex)] ?? [0, 0];
}

export function handCountFor(player: LudoMatchPlayer) {
  return player.tokens.filter((token) => token.finished).length;
}

function orderedParticipants(participants: ChallengeParticipant[]) {
  return [...participants]
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .filter((participant, index, list) => list.findIndex((entry) => entry.id === participant.id) === index);
}

export function createOnlineMatchPlayers(participants: ChallengeParticipant[], seats: LudoSeats) {
  const ordered = orderedParticipants(participants);

  if (seats === 2) {
    const localOwner = ordered[0];
    const opponentOwner = ordered[1];
    if (!localOwner || !opponentOwner) {
      throw new Error('A 2-player Ludo match needs both seats filled.');
    }

    return [
      buildLane({ id: localOwner.id, name: localOwner.name, avatar: localOwner.avatar, rating: localOwner.rating, kind: 'friend' }, 'red'),
      buildLane({ id: localOwner.id, name: localOwner.name, avatar: localOwner.avatar, rating: localOwner.rating, kind: 'friend' }, 'yellow'),
      buildLane({ id: opponentOwner.id, name: opponentOwner.name, avatar: opponentOwner.avatar, rating: opponentOwner.rating, kind: 'friend' }, 'green'),
      buildLane({ id: opponentOwner.id, name: opponentOwner.name, avatar: opponentOwner.avatar, rating: opponentOwner.rating, kind: 'friend' }, 'blue'),
    ];
  }

  return FOUR_PLAYER_COLOR_ORDER.map((color, index) => {
    const owner = ordered[index];
    if (!owner) {
      throw new Error('A 4-player Ludo match needs every seat filled.');
    }
    return buildLane({
      id: owner.id,
      name: owner.name,
      avatar: owner.avatar,
      rating: owner.rating,
      kind: 'friend',
    }, color);
  });
}

export function createLudoMatchState(input: {
  roomId: string;
  challengeId: string;
  seats: LudoSeats;
  participants: ChallengeParticipant[];
  activeStake: number;
}) {
  const players = createOnlineMatchPlayers(input.participants, input.seats);
  const turnOrder = ownerIdsInOrder(players);
  const turnOwnerId = turnOrder[0] ?? null;

  return {
    roomId: input.roomId,
    challengeId: input.challengeId,
    seats: input.seats,
    players,
    turnOrder,
    turnIndex: 0,
    turnOwnerId,
    dice: null,
    diceFace: 1,
    canRoll: true,
    message: `${turnOwnerId ? ownerNameFor(players, turnOwnerId) : 'Table'} starts the room.`,
    winnerOwnerId: null,
    activeStake: input.activeStake,
    phase: 'playing',
    lastMove: null,
    updatedAt: new Date().toISOString(),
  } satisfies LudoMatchState;
}

function nextTurnIndex(state: LudoMatchState, keepTurn: boolean) {
  if (!state.turnOrder.length) return 0;
  if (keepTurn) return state.turnIndex;
  return (state.turnIndex + 1) % state.turnOrder.length;
}

export function rollLudoMatch(state: LudoMatchState, ownerId: string, rolledValue: number) {
  if (state.phase !== 'playing') throw new Error('This Ludo match is already finished.');
  if (state.turnOwnerId !== ownerId) throw new Error('It is not your turn.');
  if (!state.canRoll) throw new Error('A token move is still pending.');
  if (!Number.isInteger(rolledValue) || rolledValue < 1 || rolledValue > 6) {
    throw new Error('Dice roll must be between 1 and 6.');
  }

  const movable = getMovableTokenRefs(state.players, ownerId, rolledValue);
  const currentName = ownerNameFor(state.players, ownerId);

  if (!movable.length) {
    const keepTurn = rolledValue === 6;
    const turnIndex = nextTurnIndex(state, keepTurn);
    return {
      ...state,
      turnIndex,
      turnOwnerId: state.turnOrder[turnIndex] ?? null,
      dice: rolledValue,
      diceFace: rolledValue,
      canRoll: true,
      message: rolledValue === 6
        ? `${currentName} rolled 6 but has no legal move.`
        : `${currentName} rolled ${rolledValue}. No legal move.`,
      lastMove: null,
      updatedAt: new Date().toISOString(),
    } satisfies LudoMatchState;
  }

  return {
    ...state,
    dice: rolledValue,
    diceFace: rolledValue,
    canRoll: false,
    message: `${currentName} rolled ${rolledValue}.`,
    updatedAt: new Date().toISOString(),
  } satisfies LudoMatchState;
}

export function moveLudoMatch(state: LudoMatchState, ownerId: string, laneId: string, tokenId: number) {
  if (state.phase !== 'playing') throw new Error('This Ludo match is already finished.');
  if (state.turnOwnerId !== ownerId) throw new Error('It is not your turn.');
  if (state.dice === null) throw new Error('Roll the dice before moving.');

  const nextPlayers = clonePlayers(state.players);
  const playerIndex = nextPlayers.findIndex((player) => player.laneId === laneId);
  if (playerIndex === -1) throw new Error('Lane not found for this move.');

  const player = nextPlayers[playerIndex];
  if (player.ownerId !== ownerId) throw new Error('That lane does not belong to you.');

  const tokenIndex = player.tokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex === -1) throw new Error('Token not found for this move.');

  const movable = getMovableTokenRefs(nextPlayers, ownerId, state.dice);
  if (!movable.some((entry) => entry.playerIndex === playerIndex && entry.tokenIndex === tokenIndex)) {
    throw new Error('That token cannot move with the current dice.');
  }

  const token = player.tokens[tokenIndex];
  let nextMessage = 'Move settled.';
  let winnerOwnerId: string | null = null;
  let keepTurn = state.dice === 6;
  let captured = false;

  if (token.progress === -1) {
    token.progress = 0;
    nextMessage = `${player.name} launches a token out of base.`;
  } else {
    const nextProgress = token.progress + state.dice;
    if (nextProgress > FINISH_PROGRESS) {
      throw new Error('That move would overshoot home.');
    }

    token.progress = nextProgress;
    if (nextProgress === FINISH_PROGRESS) {
      token.finished = true;
      nextMessage = `${player.name} banks a token home.`;
    } else {
      nextMessage = `${player.name} moves ${state.dice} steps.`;
    }
  }

  const boardIndex = boardIndexFor(player, token);
  if (boardIndex !== null) {
    const capturedRef = findOpponentTokenOnSquare(nextPlayers, player.ownerId, boardIndex);
    if (capturedRef) {
      const opponent = nextPlayers[capturedRef.playerIndex];
      const opponentToken = opponent.tokens[capturedRef.tokenIndex];
      opponentToken.progress = -1;
      opponentToken.finished = false;
      token.progress = FINISH_PROGRESS;
      token.finished = true;
      keepTurn = true;
      captured = true;
      nextMessage = `${player.name} knocks ${opponent.name} back to base and finishes the race.`;
    }
  }

  if (isOwnerFinished(nextPlayers, player.ownerId)) {
    winnerOwnerId = player.ownerId;
  }

  if (winnerOwnerId !== null) {
    return {
      ...state,
      players: nextPlayers,
      dice: state.dice,
      diceFace: state.diceFace,
      canRoll: false,
      winnerOwnerId,
      phase: 'finished',
      lastMove: {
        laneId: player.laneId,
        tokenId: token.id,
        captured,
      },
      message: `${ownerNameFor(nextPlayers, winnerOwnerId)} cleared the board first.`,
      updatedAt: new Date().toISOString(),
    } satisfies LudoMatchState;
  }

  const turnIndex = nextTurnIndex(state, keepTurn);
  return {
    ...state,
    players: nextPlayers,
    turnIndex,
    turnOwnerId: state.turnOrder[turnIndex] ?? null,
    dice: null,
    canRoll: true,
    lastMove: {
      laneId: player.laneId,
      tokenId: token.id,
      captured,
    },
    message: nextMessage,
    updatedAt: new Date().toISOString(),
  } satisfies LudoMatchState;
}
