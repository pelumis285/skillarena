import React from 'react';
import { GameChat } from '../components/GameChat';
import { realtimeClient } from '../lib/realtime';
import { PRIMARY_CURRENCY_LABEL } from '../lib/market';
import {
  FINISH_PROGRESS,
  FINISH_SLOTS,
  GRID_SIZE,
  LUDO_COLOR_META,
  SAFE_TRACK_INDEXES,
  TRACK_COORDS,
  TRACK_LENGTH,
  boardIndexFor,
  buildLane,
  clonePlayers,
  findOpponentTokenOnSquare,
  getMovableTokenRefs,
  handCountFor,
  isOwnerFinished,
  ownerBaseCount,
  ownerHomeCount,
  ownerIdsInOrder,
  ownerNameFor,
  ownerTokenTargetCount,
  scoreBotMove,
  stackOffsetFor,
} from '../lib/ludoEngine';
import type { LaneOwner, MovableTokenRef } from '../lib/ludoEngine';
import type {
  Challenge,
  ChallengeRoomState,
  LudoLastMove,
  LudoMatchPlayer as MatchPlayer,
  LudoMatchState,
  LudoMode,
  LudoSeats,
  LudoToken as Token,
  PlayerColor,
  PlayerKind,
  User,
} from '../lib/types';
import { mockOnlinePlayers } from '../lib/mock';
import { cn, money } from '../lib/utils';
import { Badge, Button, Field, Pill } from '../components/ui';
import { GameHero, GamePanel, GameScreen, gameFieldClass, gameInfoCardClass, gameInfoTileClass, gamePillClass, gameSelectClass } from '../components/GameShell';

type MatchPhase = 'setup' | 'playing';

type Props = {
  stake: number;
  balance: number;
  user: User;
  challenge?: Challenge;
  watchOnly?: boolean;
  onLockStake: (stake: number) => boolean;
  onFinish: (r:{score:number,won:boolean,payout:number,msg?:string})=>void;
  onExit: ()=>void;
};

const COLOR_META: Record<PlayerColor, {
  label: string;
  soft: string;
  edge: string;
  token: string;
  ink: string;
  homePath: Array<[number, number]>;
  baseSlots: Array<[number, number]>;
  baseArea: { rows: [number, number], cols: [number, number] };
}> = {
  green: {
    label: 'Green',
    soft: 'bg-[#79c41f]',
    edge: 'border-[#5fa210]',
    token: 'bg-[#2dd334]',
    ink: 'text-[#145218]',
    homePath: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    baseSlots: [[2.18,2.18],[3.82,2.18],[2.18,3.82],[3.82,3.82]],
    baseArea: { rows: [0,5], cols: [0,5] },
  },
  yellow: {
    label: 'Yellow',
    soft: 'bg-[#f2c419]',
    edge: 'border-[#d6a40c]',
    token: 'bg-[#f59f0b]',
    ink: 'text-[#7c5200]',
    homePath: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    baseSlots: [[10.18,2.18],[11.82,2.18],[10.18,3.82],[11.82,3.82]],
    baseArea: { rows: [0,5], cols: [9,14] },
  },
  red: {
    label: 'Red',
    soft: 'bg-[#ef4444]',
    edge: 'border-[#d92f2f]',
    token: 'bg-[#ef2020]',
    ink: 'text-[#7f1515]',
    homePath: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    baseSlots: [[2.18,10.18],[3.82,10.18],[2.18,11.82],[3.82,11.82]],
    baseArea: { rows: [9,14], cols: [0,5] },
  },
  blue: {
    label: 'Blue',
    soft: 'bg-[#2d8cff]',
    edge: 'border-[#1a6fd1]',
    token: 'bg-[#2152ff]',
    ink: 'text-[#12306f]',
    homePath: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
    baseSlots: [[10.18,10.18],[11.82,10.18],[10.18,11.82],[11.82,11.82]],
    baseArea: { rows: [9,14], cols: [9,14] },
  },
};

const DIE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function isTrackCell(row: number, col: number) {
  return TRACK_COORDS.some(([trackCol, trackRow]) => trackCol === col && trackRow === row);
}

function cellPercent(value: number) {
  return ((value + 0.5) / GRID_SIZE) * 100;
}

function createMatchPlayers(mode: LudoMode, seats: LudoSeats, friendId: string | undefined, user: User, challenge?: Challenge, roomState?: ChallengeRoomState | null): MatchPlayer[] {
  const seatColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  const pool = mockOnlinePlayers.filter((player) => player.game === 'ludo');
  const explicitFriend = friendId ? pool.find((player) => player.id === friendId) : undefined;
  const seededInviteId = challenge?.invitedUserId ?? challenge?.invitedUsers?.[0]?.id;
  const challengeFriend = seededInviteId ? pool.find((player)=> player.id === seededInviteId) : undefined;
  const used = new Set<string>();

  if (roomState?.participants.length) {
    const me = roomState.participants.find((participant) => participant.id === user.id) ?? {
      id: user.id,
      name: user.displayName,
      avatar: user.avatar,
      rating: user.rating,
      seatIndex: 0,
    };
    const others = roomState.participants.filter((participant) => participant.id !== me.id);
    const ordered = [me, ...others];
    if (seats === 2) {
      const localOwner: LaneOwner = {
        id: me.id,
        name: me.name,
        avatar: me.avatar,
        rating: me.rating,
        kind: 'you',
      };
      const opponentSource = ordered[1];
      const opponentOwner: LaneOwner = {
        id: opponentSource?.id ?? 'open-opponent',
        name: opponentSource?.name ?? 'Open seat',
        avatar: opponentSource?.avatar ?? '•',
        rating: opponentSource?.rating,
        kind: 'friend',
      };
      return [
        buildLane(localOwner, 'red'),
        buildLane(localOwner, 'yellow'),
        buildLane(opponentOwner, 'green'),
        buildLane(opponentOwner, 'blue'),
      ];
    }

    return seatColors.map((color, index) => {
      const source = ordered[index];
      return buildLane({
        id: source?.id ?? `open-${color}`,
        name: index === 0 ? user.displayName : source?.name ?? 'Open seat',
        avatar: index === 0 ? user.avatar : source?.avatar ?? '•',
        rating: index === 0 ? user.rating : source?.rating,
        kind: index === 0 ? 'you' : 'friend',
      }, color);
    });
  }

  const localOwner: LaneOwner = {
    id: user.id,
    name: user.displayName,
    avatar: user.avatar,
    rating: user.rating,
    kind: 'you',
  };

  if (seats === 2) {
    let source = explicitFriend || challengeFriend;
    const kind: PlayerKind = mode === 'solo' ? 'bot' : 'friend';
    if (!source) {
      source = pool.find((player) => !used.has(player.id) && player.id !== explicitFriend?.id && player.id !== challengeFriend?.id) || pool[0];
    }
    if (source) used.add(source.id);
    const opponentOwner: LaneOwner = {
      id: source.id,
      name: source.name,
      avatar: source.avatar,
      rating: source.rating,
      kind,
    };
    return [
      buildLane(localOwner, 'red'),
      buildLane(localOwner, 'yellow'),
      buildLane(opponentOwner, 'green'),
      buildLane(opponentOwner, 'blue'),
    ];
  }

  const local = buildLane(localOwner, 'red');

  const others = seatColors.slice(1).map((color, index): MatchPlayer => {
    let source = index === 0 ? explicitFriend || challengeFriend : undefined;
    if (!source) {
      source = pool.find((player) => !used.has(player.id) && player.id !== explicitFriend?.id && player.id !== challengeFriend?.id) || pool[index % pool.length];
    }
    used.add(source.id);
    const kind: PlayerKind = mode === 'solo' ? 'bot' : 'friend';
    return buildLane({
      id: source.id,
      name: source.name,
      avatar: source.avatar,
      rating: source.rating,
      kind,
    }, color);
  });

  return [local, ...others];
}


function playerTypeLabel(player: MatchPlayer, viewerUserId: string) {
  if (player.ownerId === viewerUserId || player.kind === 'you') return 'You';
  return player.kind === 'bot' ? 'Computer' : 'Online';
}

function playerZoneTone(player?: MatchPlayer) {
  if (!player) return 'bg-white/50 border-white/60 text-zinc-500';
  return `${COLOR_META[player.color].soft} ${COLOR_META[player.color].edge} ${COLOR_META[player.color].ink}`;
}

function DiceFace({ value }: { value: number }) {
  const activePips = DIE_PIPS[value] ?? DIE_PIPS[1];

  return (
    <div className="grid h-full w-full grid-cols-3 gap-[8%] p-[18%]">
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'rounded-full bg-[#111827] transition duration-150',
            activePips.includes(index) ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
          )}
        />
      ))}
    </div>
  );
}

export function LudoRush({ stake, balance, user, challenge, watchOnly = false, onLockStake, onFinish, onExit }: Props) {
  const [phase, setPhase] = React.useState<MatchPhase>('setup');
  const [mode, setMode] = React.useState<LudoMode>(challenge?.mode ?? 'solo');
  const [seats, setSeats] = React.useState<LudoSeats>(challenge?.seats ?? 2);
  const [selectedFriendId, setSelectedFriendId] = React.useState<string>(challenge?.invitedUserId ?? challenge?.invitedUsers?.[0]?.id ?? mockOnlinePlayers.find((player)=> player.game === 'ludo')?.id ?? '');
  const [stakeInput, setStakeInput] = React.useState<number>(challenge?.stake ?? (stake > 0 ? stake : 4000));
  const [setupNote, setSetupNote] = React.useState<string>(challenge ? 'Review the room and lock your seat to begin.' : 'Choose solo or friends, pick your stake, and launch the table.');

  const [players, setPlayers] = React.useState<MatchPlayer[]>([]);
  const [turn, setTurn] = React.useState(0);
  const [dice, setDice] = React.useState<number|null>(null);
  const [diceFace, setDiceFace] = React.useState(1);
  const [isRolling, setIsRolling] = React.useState(false);
  const [canRoll, setCanRoll] = React.useState(true);
  const [message, setMessage] = React.useState('Roll to start. Need a 6 to bring a token out.');
  const [winner, setWinner] = React.useState<string | null>(null);
  const [activeStake, setActiveStake] = React.useState<number>(challenge?.stake ?? stake);
  const [lastLocalMove, setLastLocalMove] = React.useState<LudoLastMove | null>(null);
  const [onlineMatch, setOnlineMatch] = React.useState<LudoMatchState | null>(null);
  const [launchingMatch, setLaunchingMatch] = React.useState(false);
  const [onlineBusy, setOnlineBusy] = React.useState(false);
  const rollIntervalRef = React.useRef<number | null>(null);
  const settleTimeoutRef = React.useRef<number | null>(null);
  const completedOnlineWinnerRef = React.useRef<string | null>(null);
  const [roomState, setRoomState] = React.useState<ChallengeRoomState | null>(challenge?.roomId ? {
    roomId: challenge.roomId,
    challengeId: challenge.id,
    game: challenge.game,
    seats: challenge.seats ?? 2,
    participants: challenge.participants ?? [{
      id: challenge.creator.id,
      name: challenge.creator.name,
      avatar: challenge.creator.avatar,
      rating: challenge.creator.rating,
      seatIndex: 0,
      ready: false,
    }],
    hostUserId: challenge.creator.id,
    inviteCode: challenge.inviteCode,
    spectators: [],
    state: challenge.status === 'finished'
      ? 'finished'
      : challenge.status === 'in_progress'
        ? 'in_progress'
        : (challenge.seatsFilled ?? challenge.participants?.length ?? 1) >= (challenge.seats ?? 2)
          ? 'ready'
          : 'waiting',
  } : null);

  const friendPool = React.useMemo(
    () => mockOnlinePlayers.filter((player) => player.game === 'ludo'),
    [],
  );
  const challengeRoomId = challenge?.roomId;
  const spectatorMode = watchOnly && !!challengeRoomId;

  React.useEffect(() => {
    if (!challengeRoomId || !realtimeClient.isConfigured) return;

    let disposed = false;
    const liveRoomId = challengeRoomId;

    async function joinLiveRoom() {
      const connected = await realtimeClient.connect(user).catch(() => false);
      if (!connected || disposed) return;
      const joinedRoom = await realtimeClient.joinRoom(liveRoomId, user).catch(() => null);
      if (!disposed && joinedRoom) setRoomState(joinedRoom);
    }

    const offRoom = realtimeClient.onRoom((nextRoom) => {
      if (disposed || nextRoom.roomId !== liveRoomId) return;
      setRoomState(nextRoom);
    });
    const offLudo = realtimeClient.onLudoState((nextMatch) => {
      if (disposed || nextMatch.roomId !== liveRoomId) return;
      setOnlineMatch(nextMatch);
    });

    joinLiveRoom();
    return () => {
      disposed = true;
      offRoom();
      offLudo();
    };
  }, [challengeRoomId, user]);

  React.useEffect(() => {
    if (mode === 'solo' && seats !== 2) setSeats(2);
  }, [mode, seats]);

  React.useEffect(() => {
    if (!onlineMatch) return;
    setPhase('playing');
    setActiveStake(onlineMatch.activeStake);
  }, [onlineMatch]);

  React.useEffect(() => {
    if (spectatorMode) return;
    if (!onlineMatch?.winnerOwnerId) {
      completedOnlineWinnerRef.current = null;
      return;
    }
    if (completedOnlineWinnerRef.current === onlineMatch.winnerOwnerId) return;

    completedOnlineWinnerRef.current = onlineMatch.winnerOwnerId;
    const winningOwnerId = onlineMatch.winnerOwnerId;
    const won = winningOwnerId === user.id;
    const payout = onlineMatch.activeStake > 0 ? onlineMatch.activeStake * onlineMatch.turnOrder.length * 0.93 : 0;
    const score = onlineMatch.players.reduce(
      (sum, player) => player.ownerId === winningOwnerId ? sum : sum + player.tokens.filter((token) => !token.finished).length,
      0,
    );
    const winnerName = ownerNameFor(onlineMatch.players, winningOwnerId);
    const tokenTarget = ownerTokenTargetCount(onlineMatch.players, winningOwnerId);
    const timer = window.setTimeout(() => onFinish({
      score,
      won,
      payout: won ? payout : 0,
      msg: won ? `You cleared all ${tokenTarget} tokens home.` : `${winnerName} cleared the board first.`,
    }), 900);

    return () => window.clearTimeout(timer);
  }, [onlineMatch, onFinish, spectatorMode, user.id]);

  const livePlayers = onlineMatch?.players ?? players;
  const turnOwnerIds = React.useMemo(
    () => onlineMatch?.turnOrder ?? ownerIdsInOrder(players),
    [onlineMatch, players],
  );
  const liveTurnIndex = onlineMatch?.turnIndex ?? turn;
  const currentOwnerId = onlineMatch?.turnOwnerId ?? turnOwnerIds[liveTurnIndex] ?? null;
  const sides = React.useMemo(
    () => turnOwnerIds.map((ownerId) => {
      const lanes = livePlayers.filter((player) => player.ownerId === ownerId);
      const sample = lanes[0];
      return {
        ownerId,
        sample,
        colors: lanes.map((player) => player.color),
        inBase: ownerBaseCount(livePlayers, ownerId),
        home: ownerHomeCount(livePlayers, ownerId),
        totalTokens: ownerTokenTargetCount(livePlayers, ownerId),
      };
    }),
    [livePlayers, turnOwnerIds],
  );
  const currentSide = sides[liveTurnIndex] ?? null;
  const current = currentSide?.sample;
  const currentIsUser = !spectatorMode && currentOwnerId === user.id;
  const liveDice = onlineMatch?.dice ?? dice;
  const liveCanRoll = onlineMatch ? (onlineMatch.canRoll && !onlineBusy && !spectatorMode) : canRoll;
  const liveWinner = onlineMatch?.winnerOwnerId ?? winner;
  const liveMessage = onlineMatch?.message ?? message;
  const liveStake = onlineMatch?.activeStake ?? activeStake;
  const liveLastMove = onlineMatch?.lastMove ?? lastLocalMove;
  const sideCount = turnOwnerIds.length;
  const pot = liveStake > 0 ? liveStake * sideCount : 0;
  const safeCells = React.useMemo(
    () => new Set(Array.from(SAFE_TRACK_INDEXES).map((index) => TRACK_COORDS[index].join('-'))),
    [],
  );

  const clearRollAnimation = React.useCallback(() => {
    if (rollIntervalRef.current !== null) {
      window.clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearRollAnimation(), [clearRollAnimation]);

  const launchMatch = React.useCallback(async () => {
    const desiredStake = Math.max(0, Number(stakeInput) || 0);
    const liveSeats = roomState?.seats ?? seats;
    if (roomState && roomState.participants.length < liveSeats) {
      setSetupNote(`Waiting for ${liveSeats - roomState.participants.length} more player${liveSeats - roomState.participants.length === 1 ? '' : 's'} to join this room.`);
      return;
    }
    if (roomState && challengeRoomId && realtimeClient.isConfigured && roomState.state !== 'ready' && roomState.state !== 'in_progress') {
      setSetupNote('Everyone must mark ready before the synced Ludo room can start.');
      return;
    }
    const shouldLockStake = desiredStake > 0 && roomState?.state !== 'in_progress';
    if (shouldLockStake && !onLockStake(desiredStake)) {
      setSetupNote(`You need ${money(desiredStake)} available to lock this seat.`);
      return;
    }

    if (roomState && challengeRoomId && realtimeClient.isConfigured) {
      setLaunchingMatch(true);
      const nextMatch = await realtimeClient.startLudo(roomState.roomId, user.id, desiredStake).catch(() => null);
      setLaunchingMatch(false);
      if (!nextMatch) {
        setSetupNote('Could not start the synced Ludo match. Check the room connection and try again.');
        return;
      }
      setOnlineMatch(nextMatch);
      setActiveStake(nextMatch.activeStake);
      setPhase('playing');
      return;
    }

    const createdPlayers = createMatchPlayers(mode, liveSeats, selectedFriendId, user, challenge, roomState);
    setPlayers(createdPlayers);
    setTurn(0);
    setDice(null);
    setCanRoll(true);
    setWinner(null);
    setActiveStake(desiredStake);
    setLastLocalMove(null);
    setPhase('playing');
    setMessage(
      challenge
        ? `Seat locked. ${ownerNameFor(createdPlayers, createdPlayers[0].ownerId)} starts the room.`
        : mode === 'solo'
          ? 'Solo table ready. Roll a 6 to launch.'
          : `${liveSeats}-player room ready. Roll a 6 to launch.`,
    );
  }, [challenge, challengeRoomId, mode, onLockStake, roomState, seats, selectedFriendId, stakeInput, user]);

  const getTokenCell = React.useCallback((player: MatchPlayer, token: Token) => {
    const spread = stackOffsetFor(player, token);
    if (token.progress === -1) {
      const [col, row] = COLOR_META[player.color].baseSlots[token.id];
      return { left: cellPercent(col), top: cellPercent(row) };
    }
    if (token.finished) {
      const [col, row] = FINISH_SLOTS[token.id];
      return { left: cellPercent(col), top: cellPercent(row) };
    }
    if (token.progress >= TRACK_LENGTH) {
      const [col, row] = COLOR_META[player.color].homePath[token.progress - TRACK_LENGTH];
      return { left: cellPercent(col + spread[0]), top: cellPercent(row + spread[1]) };
    }
    const boardIndex = boardIndexFor(player, token)!;
    const [col, row] = TRACK_COORDS[boardIndex];
    return { left: cellPercent(col + spread[0]), top: cellPercent(row + spread[1]) };
  }, []);

  const moveToken = React.useCallback(async (playerIndex: number, tokenIndex: number) => {
    if (onlineMatch && challengeRoomId) {
      const player = livePlayers[playerIndex];
      const token = player?.tokens[tokenIndex];
      if (!player || !token || liveWinner !== null) return;
      setOnlineBusy(true);
      const nextMatch = await realtimeClient.moveLudo(challengeRoomId, user.id, player.laneId, token.id).catch(() => null);
      setOnlineBusy(false);
      if (nextMatch) setOnlineMatch(nextMatch);
      return;
    }

    if (!players.length || dice === null || winner !== null || !currentOwnerId) return;

    let nextMessage = 'Move settled.';
    let winnerOwnerId: string | null = null;
    let keepTurn = dice === 6;
    let lastMove: LudoLastMove | null = null;

    setPlayers((currentPlayers) => {
      const nextPlayers = clonePlayers(currentPlayers);
      const player = nextPlayers[playerIndex];
      if (!player || player.ownerId !== currentOwnerId) return currentPlayers;

      const token = player.tokens[tokenIndex];
      if (!token || token.finished) return currentPlayers;

      if (token.progress === -1) {
        if (dice !== 6) return currentPlayers;
        token.progress = 0;
        nextMessage = `${player.name} launches a token out of base.`;
      } else {
        const nextProgress = token.progress + dice;
        if (nextProgress > FINISH_PROGRESS) return currentPlayers;
        token.progress = nextProgress;
        if (nextProgress === FINISH_PROGRESS) {
          token.finished = true;
          nextMessage = `${player.name} banks a token home.`;
        } else {
          nextMessage = `${player.name} moves ${dice} steps.`;
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
          nextMessage = `${player.name} knocks ${opponent.name} back to base and finishes the race.`;
          lastMove = {
            laneId: player.laneId,
            tokenId: token.id,
            captured: true,
          };
        }
      }

      if (!lastMove) {
        lastMove = {
          laneId: player.laneId,
          tokenId: token.id,
          captured: false,
        };
      }

      if (isOwnerFinished(nextPlayers, player.ownerId)) {
        winnerOwnerId = player.ownerId;
      }

      return nextPlayers;
    });

    setMessage(nextMessage);
    setLastLocalMove(lastMove);

    if (winnerOwnerId !== null) {
      setWinner(winnerOwnerId);
      const won = winnerOwnerId === user.id;
      const payout = activeStake > 0 ? activeStake * sideCount * 0.93 : 0;
      const score = players.reduce((sum, player) => player.ownerId === winnerOwnerId ? sum : sum + player.tokens.filter((token) => !token.finished).length, 0);
      const winnerName = ownerNameFor(players, winnerOwnerId);
      const tokenTarget = ownerTokenTargetCount(players, winnerOwnerId);
      setTimeout(() => onFinish({
        score,
        won,
        payout: won ? payout : 0,
        msg: won ? `You cleared all ${tokenTarget} tokens home.` : `${winnerName} cleared the board first.`,
      }), 900);
      return;
    }

    setTimeout(() => {
      setDice(null);
      setCanRoll(true);
      if (!keepTurn) {
        setTurn((value) => (value + 1) % turnOwnerIds.length);
      }
    }, 450);
  }, [activeStake, challengeRoomId, currentOwnerId, dice, livePlayers, liveWinner, onFinish, onlineMatch, players, sideCount, turnOwnerIds.length, user.id, winner]);

  const settleRoll = React.useCallback((roll: number) => {
    if (!currentOwnerId) return;

    setDice(roll);
    setDiceFace(roll);

    const movable = getMovableTokenRefs(players, currentOwnerId, roll);
    if (!movable.length) {
      const currentName = ownerNameFor(players, currentOwnerId);
      setMessage(roll === 6 ? `${currentName} rolled 6 but has no legal move.` : `${currentName} rolled ${roll}. No legal move.`);
      window.setTimeout(() => {
        setDice(null);
        setCanRoll(true);
        if (roll !== 6) setTurn((value) => (value + 1) % turnOwnerIds.length);
      }, 850);
      return;
    }

    if (currentIsUser) {
      setMessage(`You rolled ${roll}. Choose a token to move.`);
    } else {
      setMessage(`${ownerNameFor(players, currentOwnerId)} rolled ${roll}.`);
    }
  }, [currentIsUser, currentOwnerId, players, turnOwnerIds.length]);

  const rollDice = React.useCallback(async () => {
    if (onlineMatch && challengeRoomId) {
      if (!currentIsUser || !currentOwnerId || liveWinner !== null || !liveCanRoll) return;
      clearRollAnimation();
      setOnlineBusy(true);
      setIsRolling(true);
      rollIntervalRef.current = window.setInterval(() => {
        setDiceFace(1 + Math.floor(Math.random() * 6));
      }, 90);
      const nextMatch = await realtimeClient.rollLudo(challengeRoomId, user.id).catch(() => null);
      clearRollAnimation();
      setIsRolling(false);
      setOnlineBusy(false);
      if (nextMatch) setOnlineMatch(nextMatch);
      return;
    }

    if (!players.length || !canRoll || winner !== null || !currentOwnerId) return;

    const roll = 1 + Math.floor(Math.random() * 6);
    clearRollAnimation();
    setCanRoll(false);
    setDice(null);
    setIsRolling(true);
    setMessage(currentIsUser ? 'Throwing dice…' : `${ownerNameFor(players, currentOwnerId)} is throwing the dice…`);

    rollIntervalRef.current = window.setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6));
    }, 90);

    settleTimeoutRef.current = window.setTimeout(() => {
      clearRollAnimation();
      setIsRolling(false);
      settleRoll(roll);
    }, 720);
  }, [canRoll, challengeRoomId, clearRollAnimation, currentIsUser, currentOwnerId, liveCanRoll, liveWinner, onlineMatch, players, settleRoll, user.id, winner]);

  React.useEffect(() => {
    if (onlineMatch) return;
    if (phase !== 'playing' || !players.length || winner !== null || currentIsUser || !currentOwnerId) return;
    if (canRoll) {
      const timer = setTimeout(() => rollDice(), 850);
      return () => clearTimeout(timer);
    }
    if (dice !== null) {
      const available = getMovableTokenRefs(players, currentOwnerId, dice);
      if (!available.length) return;
      const sorted = [...available].sort(
        (left, right) => scoreBotMove(players, right.playerIndex, right.tokenIndex, dice) - scoreBotMove(players, left.playerIndex, left.tokenIndex, dice),
      );
      const timer = setTimeout(() => moveToken(sorted[0].playerIndex, sorted[0].tokenIndex), 900);
      return () => clearTimeout(timer);
    }
  }, [canRoll, currentIsUser, currentOwnerId, dice, moveToken, onlineMatch, phase, players, rollDice, winner]);

  const playableTokens = phase === 'playing' && liveDice !== null && currentIsUser && currentOwnerId
    ? getMovableTokenRefs(livePlayers, currentOwnerId, liveDice)
    : [];
  const playableTokenKeys = new Set(playableTokens.map((token) => `${token.playerIndex}-${token.tokenIndex}`));
  const myRoomReady = roomState?.participants.find((participant) => participant.id === user.id)?.ready ?? false;

  const toggleReady = React.useCallback(async () => {
    if (!roomState) return;
    const nextState = await realtimeClient.setRoomReady(roomState.roomId, user.id, !myRoomReady).catch(() => null);
    if (nextState) setRoomState(nextState);
  }, [myRoomReady, roomState, user.id]);

  if (phase === 'setup') {
    if (spectatorMode) {
      return (
        <GameScreen className="max-w-5xl">
          <GameHero
            accent="lime"
            eyebrow="Ludo Rush"
            title="Spectator lounge"
            subtitle="You are joining this live board as a watcher. Once the room state lands, the board will switch into the live match automatically and the chat stays open while you wait."
            onExit={onExit}
            exitLabel="Leave watch"
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant="gold">Watching live</Badge>
              <Badge variant="emerald">{challenge?.inviteCode || 'Public room'}</Badge>
              <Badge variant="default">Chat and follow the board</Badge>
            </div>
          </GameHero>

          <div className="grid lg:grid-cols-[minmax(360px,1fr)_360px] gap-6 items-start">
            <GamePanel className="p-6">
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Joining board</div>
              <div className="mt-2 text-[28px] font-[800] tracking-[-0.05em] text-white">
                {challenge?.creator.name}'s live room
              </div>
              <div className="mt-3 text-[13.6px] leading-6 text-slate-300">
                Spectators can watch the live board and chat with the room while the current group finishes. This same watcher flow is what we can build tournament rounds on top of next.
              </div>
              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-[13px] text-slate-300">
                {roomState?.state === 'in_progress'
                  ? 'The live room is already in motion. Loading the board…'
                  : 'Waiting for the room to go live.'}
              </div>
            </GamePanel>
            <GameChat challenge={challenge} user={user} />
          </div>
        </GameScreen>
      );
    }

    const previewSeats = roomState?.seats ?? (mode === 'solo' ? 2 : seats);
    const projectedPot = stakeInput > 0 ? stakeInput * previewSeats : 0;
    const selectedFriend = friendPool.find((player)=> player.id === selectedFriendId);
    const missingSeats = roomState ? Math.max(0, roomState.seats - roomState.participants.length) : 0;
    const roomCanLaunch = !roomState
      || roomState.state === 'in_progress'
      || (roomState.participants.length >= roomState.seats && (!challengeRoomId || roomState.state === 'ready'));

    return (
      <GameScreen className="max-w-6xl">
        <GameHero
          accent="lime"
          eyebrow="Ludo Rush"
          title="Build your Ludo room."
          subtitle="Choose solo vs computer or open a friends room with 2 or 4 seats. In 2-player Ludo, each side controls two opposite houses instead of adjacent corners."
          onExit={onExit}
          exitLabel="Leave table"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="gold">{challenge ? 'Challenge room' : 'Quick start'}</Badge>
            <Badge variant="emerald">Visible avatar board</Badge>
            <Badge variant="default">Wallet-backed stakes</Badge>
          </div>
        </GameHero>

        <div className="grid lg:grid-cols-[minmax(360px,1fr)_360px] gap-6 items-start">
          <GamePanel className="p-5 sm:p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setMode('solo')}
                className={cn(
                  'rounded-[24px] border p-4 text-left text-white transition',
                  mode === 'solo'
                    ? 'border-lime-300/35 bg-gradient-to-br from-lime-500/28 via-emerald-500/18 to-cyan-500/8 shadow-[0_18px_50px_rgba(132,204,22,0.18)]'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                )}
              >
                <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Single</div>
                <div className="mt-2 text-[22px] font-[720] tracking-tight">Play the computer</div>
                <div className="mt-2 text-[13.4px] leading-6 text-slate-300">One wallet stake. One AI opponent. In 2-player play, both sides control two opposite houses.</div>
              </button>

              <button
                onClick={() => setMode('friends')}
                className={cn(
                  'rounded-[24px] border p-4 text-left text-white transition',
                  mode === 'friends'
                    ? 'border-lime-300/35 bg-gradient-to-br from-emerald-500/28 via-lime-500/16 to-sky-500/10 shadow-[0_18px_50px_rgba(16,185,129,0.18)]'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                )}
              >
                <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Friends online</div>
                <div className="mt-2 text-[22px] font-[720] tracking-tight">2 or 4 players</div>
                <div className="mt-2 text-[13.4px] leading-6 text-slate-300">Everyone brings their own stake. Two-player rooms use opposite house pairs, while four-player rooms use one house each.</div>
              </button>
            </div>

            <div className="mt-5 grid md:grid-cols-2 gap-3">
              <Field
                label={mode === 'friends' ? `Stake per seat (${PRIMARY_CURRENCY_LABEL})` : `Solo stake (${PRIMARY_CURRENCY_LABEL})`}
                type="number"
                value={stakeInput}
                className={gameFieldClass}
                onChange={e=>setStakeInput(Math.max(0, parseFloat(e.target.value)||0))}
              />
              <label className="block text-[12.8px]">
                <div className="mb-1.5 font-[550] text-slate-300">Seats</div>
                <select value={mode === 'solo' ? 2 : seats} disabled={mode === 'solo'} onChange={e=>setSeats(Number(e.target.value) as LudoSeats)} className={gameSelectClass}>
                  <option value={2} className="bg-slate-900 text-white">2 players</option>
                  <option value={4} className="bg-slate-900 text-white">4 players</option>
                </select>
              </label>
            </div>

            {mode === 'friends' && (
              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <label className="block text-[12.8px]">
                  <div className="mb-1.5 font-[550] text-slate-300">Invite friend</div>
                  <select value={selectedFriendId} onChange={e=>setSelectedFriendId(e.target.value)} className={gameSelectClass}>
                    {friendPool.map((player)=>(
                      <option key={player.id} value={player.id} className="bg-slate-900 text-white">{player.name} • {player.rating} • {player.stakePref}</option>
                    ))}
                  </select>
                </label>
                <div className={gameInfoCardClass}>
                  <div className="font-[650] text-white">Friend room details</div>
                  <div className="mt-1">{selectedFriend ? `${selectedFriend.avatar} ${selectedFriend.name} gets the first invite.` : 'Choose who should get the first seat invite.'}</div>
                  <div className="mt-2 text-[12.8px] leading-5 text-slate-400">For posted invites, use the Challenges tab to publish a public or private room.</div>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <div className="grid sm:grid-cols-4 gap-3 text-[13px]">
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Your wallet</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{money(balance)}</div>
                </div>
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Room size</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{previewSeats} seats</div>
                </div>
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Projected pot</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{projectedPot ? money(projectedPot) : 'Practice'}</div>
                </div>
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Winner payout</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{projectedPot ? money(projectedPot * 0.93) : '—'}</div>
                </div>
              </div>
              <div className="mt-3 text-[12.8px] text-slate-400">{setupNote}</div>
            </div>

            {roomState && (
              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Live room</div>
                    <div className="mt-1 text-[20px] font-[730] tracking-tight text-white">{roomState.participants.length}/{roomState.seats} seats joined</div>
                    <div className="text-[12.8px] text-slate-400">
                      {roomState.state === 'in_progress'
                        ? 'A synced Ludo match is already live in this room.'
                        : roomState.state === 'ready'
                          ? 'Everyone is ready. Start the synced match when you are.'
                          : missingSeats
                            ? `Waiting for ${missingSeats} more player${missingSeats === 1 ? '' : 's'}.`
                            : 'All seats filled. Mark ready to launch.'}
                    </div>
                  </div>
                  <div className="text-right text-[12.5px] text-slate-400">
                    <div>Room code</div>
                    <div className="mt-1 font-[700] text-white">{roomState.inviteCode || 'Public room'}</div>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-2">
                  {Array.from({ length: roomState.seats }).map((_, seatIndex) => {
                    const participant = roomState.participants.find((entry) => entry.seatIndex === seatIndex);
                    return (
                      <div key={seatIndex} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-[20px]">{participant?.avatar || '•'}</div>
                          <div className="min-w-0">
                            <div className="truncate font-[650] text-white">{participant?.name || 'Open seat'}</div>
                            <div className="text-[12px] text-slate-400">{participant ? `Seat ${seatIndex + 1}` : 'Waiting for join'}</div>
                          </div>
                        </div>
                        <Pill className={participant?.ready ? 'border border-emerald-400/20 bg-emerald-500/14 text-emerald-200' : gamePillClass}>
                          {participant ? (participant.ready ? 'Ready' : 'Joined') : 'Open'}
                        </Pill>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant={myRoomReady ? 'secondary' : 'primary'} onClick={toggleReady} disabled={roomState.state === 'in_progress'}>{myRoomReady ? 'Unready' : 'Mark ready'}</Button>
                  <Button variant="secondary" onClick={() => setSetupNote(roomState.inviteCode ? `Share room code ${roomState.inviteCode} with friends.` : 'Room is public in the Challenges tab.')}>Share room</Button>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <Button className="flex-1 justify-center" disabled={!roomCanLaunch || launchingMatch} onClick={launchMatch}>
                {launchingMatch
                  ? 'Starting live room…'
                  : challengeRoomId && roomState?.state === 'in_progress'
                    ? 'Rejoin live match'
                    : challenge
                      ? 'Lock seat & start'
                      : mode === 'solo'
                        ? 'Start solo match'
                        : 'Open room'}
              </Button>
              <Button variant="secondary" onClick={onExit}>Back</Button>
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="font-[680] text-white">What this setup gives you</div>
            <div className="mt-3 space-y-3 text-[13.4px]">
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Visible board state</div>
                <div className="mt-1 leading-6 text-slate-300">Players can see every active color lane, the dice, the pot, and who is moving.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Avatar home zones</div>
                <div className="mt-1 leading-6 text-slate-300">Each player’s avatar sits in their colored home quadrant, making it obvious which tokens belong to whom.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Solo or friends flow</div>
                <div className="mt-1 leading-6 text-slate-300">Solo uses one seat against the computer. Friends mode supports 2- or 4-player wallet-backed rooms.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Challenge posting</div>
                <div className="mt-1 leading-6 text-slate-300">Private invite rooms live in the Challenges tab, where players can post a table and send a friend invite code.</div>
              </div>
            </div>
          </GamePanel>
          <GameChat challenge={challenge} user={user} />
        </div>
      </GameScreen>
    );
  }

  const activeQuadrants = new Map<PlayerColor, MatchPlayer>();
  livePlayers.forEach((player) => activeQuadrants.set(player.color, player));

  function tokenLayer(player: MatchPlayer, token: Token, playerIndex: number, tokenIndex: number) {
    const tokenKeyMatchesLastMove = liveLastMove?.laneId === player.laneId && liveLastMove?.tokenId === token.id;
    if (tokenKeyMatchesLastMove) return 60;
    if (playableTokenKeys.has(`${playerIndex}-${tokenIndex}`)) return 40;
    if (token.finished) return 18;
    if (token.progress === -1) return 12 + tokenIndex;
    return 20 + token.progress;
  }

  return (
    <GameScreen className="max-w-7xl">
      <style>{`
        @keyframes ludo-dice-toss {
          0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(0.96); }
          18% { transform: translate3d(-12%, -26%, 0) rotate(-18deg) scale(1.06); }
          48% { transform: translate3d(14%, -12%, 0) rotate(18deg) scale(1.12); }
          76% { transform: translate3d(-8%, 8%, 0) rotate(-10deg) scale(0.98); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
        }
      `}</style>
      <GameHero
        accent="lime"
        eyebrow="Ludo Rush"
        title={spectatorMode ? 'Live board watch' : mode === 'solo' ? 'Solo board live' : `${sideCount}-player room live`}
        subtitle="Cleaner board chrome, brighter turn information, and a layout that feels like part of the same premium arena as the rest of the app."
        onExit={onExit}
        exitLabel="Leave table"
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="gold">Stake {liveStake ? money(liveStake) : 'Practice'}</Badge>
          <Badge variant="default">{spectatorMode ? 'Watching live' : mode === 'solo' ? 'Solo vs computer' : `${sideCount} players online`}</Badge>
          <Badge variant="emerald">{current?.avatar || '•'} {current?.name || 'Waiting'} on move</Badge>
        </div>
      </GameHero>

      <div className="grid gap-5 items-start xl:grid-cols-[minmax(420px,1fr)_360px] sm:gap-6">
        <GamePanel className="p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Match pot</div>
              <div className="mt-1 text-[22px] font-[760] tracking-tight text-white">{pot ? money(pot) : 'Practice'}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">On move</div>
              <div className="mt-1 text-[14px] font-[680] text-white">{current?.name || 'Waiting'}</div>
            </div>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/10 bg-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] sm:rounded-[32px] sm:p-3">
            <div className="relative h-full w-full">
              <div className="grid h-full w-full rounded-[24px] overflow-hidden" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                  const row = Math.floor(index / GRID_SIZE);
                  const col = index % GRID_SIZE;
                  const homeColor = (Object.keys(COLOR_META) as PlayerColor[]).find((color) => COLOR_META[color].homePath.some(([homeCol, homeRow]) => homeCol === col && homeRow === row));
                  const baseColor = (Object.keys(COLOR_META) as PlayerColor[]).find((color) => {
                    const area = COLOR_META[color].baseArea;
                    return row >= area.rows[0] && row <= area.rows[1] && col >= area.cols[0] && col <= area.cols[1];
                  });
                  const key = `${col}-${row}`;
                  const track = isTrackCell(row, col);
                  const safe = safeCells.has(key);
                  const startColor = (Object.keys(COLOR_META) as PlayerColor[]).find((color) => {
                    const [startCol, startRow] = TRACK_COORDS[LUDO_COLOR_META[color].startIndex];
                    return startCol === col && startRow === row;
                  });

                  return (
                    <div
                      key={key}
                      className={cn(
                        'relative border',
                        track || (!baseColor && !homeColor) ? 'border-zinc-500/70' : 'border-transparent',
                        baseColor && !track && !homeColor && COLOR_META[baseColor].soft,
                        homeColor && `${COLOR_META[homeColor].soft} brightness-105`,
                        track && 'bg-white',
                        !baseColor && !homeColor && !track && 'bg-white',
                      )}
                    >
                      {safe && <span className="absolute inset-0 grid place-items-center text-[9px] text-zinc-500 sm:text-[12px]">★</span>}
                      {startColor && (
                        <span className={cn('absolute inset-0 grid place-items-center text-[9px] font-[800] sm:text-[12px]', COLOR_META[startColor].ink)}>
                          {startColor === 'green' ? '→' : startColor === 'yellow' ? '↓' : startColor === 'red' ? '↑' : '←'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {(Object.keys(COLOR_META) as PlayerColor[]).map((color) => {
                const player = activeQuadrants.get(color);
                const area = COLOR_META[color].baseArea;
                const top = `${(area.rows[0] / GRID_SIZE) * 100 + 2.5}%`;
                const left = `${(area.cols[0] / GRID_SIZE) * 100 + 2.5}%`;
                const width = `${((area.cols[1] - area.cols[0] + 1) / GRID_SIZE) * 100 - 5}%`;
                const height = `${((area.rows[1] - area.rows[0] + 1) / GRID_SIZE) * 100 - 5}%`;

                return (
                  <div key={color} style={{ top, left, width, height }} className="absolute p-2 sm:p-3">
                    <div className="absolute inset-0 rounded-[20px] border-[3px] border-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:rounded-[26px] sm:border-[4px]" />
                    <div className="absolute inset-[16%] rounded-full border-[4px] border-white bg-white shadow-sm sm:border-[5px]" />
                    <div className={cn('absolute left-2 right-2 top-2 rounded-[14px] border px-2 py-1.5 backdrop-blur-[2px] sm:left-3 sm:right-3 sm:top-3 sm:rounded-[16px] sm:px-3 sm:py-2', playerZoneTone(player))}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/5 bg-white/85 text-[16px] sm:h-9 sm:w-9 sm:text-[20px]">
                            {player?.avatar || '•'}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[10.5px] font-[700] sm:text-[12.8px]">{player?.name || 'Open seat'}</div>
                            <div className="text-[9px] opacity-80 sm:text-[11px]">{player ? playerTypeLabel(player, user.id) : 'Waiting'}</div>
                          </div>
                        </div>
                        {player && <div className="text-[9px] font-[700] sm:text-[11px]">{handCountFor(player)}/4</div>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {livePlayers.flatMap((player, playerIndex) => player.tokens.map((token, tokenIndex) => {
                const position = getTokenCell(player, token);
                const playable = playableTokenKeys.has(`${playerIndex}-${tokenIndex}`);
                const inBase = token.progress === -1;
                return (
                  <button
                    key={`${player.laneId}-${token.id}`}
                    onClick={() => { if (playable) moveToken(playerIndex, tokenIndex); }}
                    style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: tokenLayer(player, token, playerIndex, tokenIndex) }}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] border-white shadow-[0_3px_10px_rgba(0,0,0,0.15)] grid place-items-center text-white font-[780] leading-none transition',
                      inBase ? 'h-[20px] w-[20px] text-[9px] sm:h-[22px] sm:w-[22px] sm:text-[10px]' : 'h-[18px] w-[18px] text-[9px] sm:h-[20px] sm:w-[20px] sm:text-[10px]',
                      COLOR_META[player.color].token,
                      liveLastMove?.laneId === player.laneId && liveLastMove?.tokenId === token.id && 'ring-4 ring-amber-300/55 scale-[1.12]',
                      playable && 'ring-4 ring-zinc-900/20 scale-110',
                    )}
                  >
                    {token.id + 1}
                  </button>
                );
              }))}

              <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                <div
                  className="aspect-square w-[10%] min-w-[42px] max-w-[54px] rounded-[16px] border border-zinc-300 bg-[#fffdfa] shadow-[0_10px_22px_rgba(15,23,42,0.14)] dark:border-zinc-700 dark:bg-[#fffdfa] sm:min-w-[48px] sm:max-w-[62px] sm:rounded-[18px]"
                  style={{ animation: isRolling ? 'ludo-dice-toss 720ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined }}
                >
                  <DiceFace value={diceFace} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-[13.8px] text-slate-300">{liveMessage}{liveWinner !== null && ` • ${ownerNameFor(livePlayers, liveWinner)} takes the table.`}</div>
        </GamePanel>

        <div className="space-y-4">
          <GamePanel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12.7px] text-slate-400">Turn</div>
                <div className="text-[20px] font-[700] tracking-tight text-white">{current?.name || '—'}</div>
                {currentSide && <div className="mt-1 text-[12.5px] text-slate-400">{currentSide.colors.map((color) => COLOR_META[color].label).join(' + ')}</div>}
              </div>
              <Pill className={gamePillClass}>{mode === 'solo' ? 'Solo stake' : `${sideCount}-player room`}</Pill>
            </div>
            <Button disabled={!liveCanRoll || !currentIsUser || liveWinner!==null || onlineBusy} onClick={rollDice} className="w-full mt-4 py-3 justify-center">
              {onlineBusy
                ? 'Syncing move…'
                : liveCanRoll
                  ? (currentIsUser ? 'Roll dice' : `${current?.name || 'Opponent'} rolling…`)
                  : (currentIsUser ? 'Pick a highlighted token' : `${current?.name || 'Opponent'} thinking…`)}
            </Button>
            <div className="mt-3 text-[12.8px] text-slate-400">Need a 6 to launch. Land on an opponent to send them back to base. Exact roll sends a token home.</div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="mb-3 font-[660] text-white">Players on this table</div>
            <div className="space-y-2">
              {sides.map((side) => (
                <div key={side.ownerId} className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-full border border-white shadow-sm grid place-items-center text-[20px]', side.sample ? COLOR_META[side.colors[0]].soft : 'bg-zinc-200')}>{side.sample?.avatar || '•'}</div>
                    <div className="min-w-0">
                      <div className="truncate font-[650] text-white">{side.sample?.name || 'Open seat'} {side.ownerId === currentOwnerId && liveWinner === null ? '• turn' : ''}</div>
                      <div className="text-[12px] text-slate-400">{side.sample ? playerTypeLabel(side.sample, user.id) : 'Waiting'} • {side.colors.map((color) => COLOR_META[color].label).join(' + ')}</div>
                    </div>
                  </div>
                  <div className="text-right text-[12.5px] text-slate-400">
                    <div>{side.inBase} in base</div>
                    <div>{side.home}/{side.totalTokens} home</div>
                  </div>
                </div>
              ))}
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="mb-3 font-[660] text-white">Match details</div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Mode</div>
                <div className="mt-1 font-[700] text-white">{spectatorMode ? 'Spectator lounge' : mode === 'solo' ? 'Computer duel' : 'Friends table'}</div>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Stake</div>
                <div className="mt-1 font-[700] text-white">{liveStake ? money(liveStake) : 'Practice'}</div>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Seats</div>
                <div className="mt-1 font-[700] text-white">{sideCount} players</div>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Winner payout</div>
                <div className="mt-1 font-[700] text-white">{pot ? money(pot * 0.93) : '—'}</div>
              </div>
            </div>
            {challenge?.inviteCode && <div className="mt-3 text-[12.5px] text-slate-400">Invite code {challenge.inviteCode} • private room</div>}
          </GamePanel>
          <GameChat challenge={challenge} user={user} />
        </div>
      </div>
    </GameScreen>
  );
}
