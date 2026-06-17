import React from 'react';
import { Badge, Button, Field, Pill } from '../components/ui';
import { GameHero, GamePanel, GameScreen, gameFieldClass, gameInfoCardClass, gameInfoTileClass, gamePillClass, gameSelectClass } from '../components/GameShell';
import { mockOnlinePlayers } from '../lib/mock';
import { cn, money, shuffle } from '../lib/utils';
import type { Challenge, MatchMode, User } from '../lib/types';

type Props = {
  stake: number;
  balance: number;
  challenge?: Challenge;
  user: User;
  onLockStake: (stake: number) => boolean;
  onFinish: (result: { score: number; won: boolean; payout: number; msg: string; stake?: number }) => void;
  onExit: () => void;
};

type TurnSide = 'player' | 'bot';
type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';
type DemandShape = Exclude<WhotShape, 'whot'>;
type PendingKind = 2 | 5 | null;
type ArenaPhase = 'setup' | 'handoff' | 'playing';

type WhotCard = {
  id: string;
  shape: WhotShape;
  value: number;
  scoreValue: number;
};

type WhotState = {
  playerHand: WhotCard[];
  botHand: WhotCard[];
  market: WhotCard[];
  discard: WhotCard[];
  currentTurn: TurnSide;
  demandedShape: DemandShape | null;
  pendingDraw: number;
  pendingKind: PendingKind;
  message: string;
  history: string[];
  winner: TurnSide | null;
};

type TurnLabels = Record<TurnSide, string>;

const SHAPES: Array<{ id: DemandShape; label: string; symbol: string; bg: string; border: string; ink: string }> = [
  { id: 'circle', label: 'Circle', symbol: '●', bg: 'from-amber-100 via-orange-50 to-amber-200', border: 'border-amber-300', ink: 'text-amber-950' },
  { id: 'triangle', label: 'Triangle', symbol: '▲', bg: 'from-sky-100 via-cyan-50 to-sky-200', border: 'border-sky-300', ink: 'text-sky-950' },
  { id: 'cross', label: 'Cross', symbol: '✚', bg: 'from-violet-100 via-indigo-50 to-violet-200', border: 'border-violet-300', ink: 'text-violet-950' },
  { id: 'square', label: 'Square', symbol: '■', bg: 'from-emerald-100 via-teal-50 to-emerald-200', border: 'border-emerald-300', ink: 'text-emerald-950' },
  { id: 'star', label: 'Star', symbol: '★', bg: 'from-rose-100 via-pink-50 to-rose-200', border: 'border-rose-300', ink: 'text-rose-950' },
];

const SHAPE_ORDER: Record<WhotShape, number> = {
  circle: 0,
  triangle: 1,
  cross: 2,
  square: 3,
  star: 4,
  whot: 5,
};

const SHAPE_LOOKUP = Object.fromEntries(SHAPES.map((shape) => [shape.id, shape])) as Record<DemandShape, (typeof SHAPES)[number]>;
const OPENING_HAND = 6;
const ATTACK_VALUES = new Set([1, 2, 5, 8, 14]);

function sortHand(hand: WhotCard[]) {
  return [...hand].sort((a, b) => {
    const shapeDiff = SHAPE_ORDER[a.shape] - SHAPE_ORDER[b.shape];
    return shapeDiff !== 0 ? shapeDiff : a.value - b.value;
  });
}

function buildDeck() {
  const deck: WhotCard[] = [];
  let serial = 0;
  const addCards = (shape: WhotShape, values: number[]) => {
    values.forEach((value) => {
      deck.push({
        id: `${shape}-${value}-${serial++}`,
        shape,
        value,
        scoreValue: shape === 'star' ? value * 2 : value,
      });
    });
  };

  addCards('circle', [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
  addCards('triangle', [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
  addCards('cross', [1, 2, 3, 5, 7, 10, 11, 13, 14]);
  addCards('square', [1, 2, 3, 5, 7, 10, 11, 13, 14]);
  addCards('star', [1, 2, 3, 4, 5, 7, 8]);
  addCards('whot', [20, 20, 20, 20, 20]);

  return shuffle(deck);
}

function getTopCard(state: WhotState) {
  return state.discard[state.discard.length - 1];
}

function isNeutralOpeningCard(card: WhotCard) {
  return card.shape !== 'whot' && !ATTACK_VALUES.has(card.value);
}

function createWhotState(): WhotState {
  const deck = buildDeck();
  const playerHand = sortHand(deck.splice(0, OPENING_HAND));
  const botHand = sortHand(deck.splice(0, OPENING_HAND));

  let openingIndex = deck.findIndex(isNeutralOpeningCard);
  if (openingIndex === -1) openingIndex = deck.findIndex((card) => card.shape !== 'whot');
  if (openingIndex === -1) openingIndex = 0;
  const [openingCard] = deck.splice(openingIndex, 1);

  return {
    playerHand,
    botHand,
    market: deck,
    discard: [openingCard],
    currentTurn: 'player',
    demandedShape: null,
    pendingDraw: 0,
    pendingKind: null,
    message: `Call card is ${describeCard(openingCard)}. Your lead.`,
    history: [`Table opened on ${describeCard(openingCard)}.`],
    winner: null,
  };
}

function recycleMarket(market: WhotCard[], discard: WhotCard[]) {
  if (market.length > 0 || discard.length <= 1) {
    return { market: [...market], discard: [...discard] };
  }
  const topCard = discard[discard.length - 1];
  return {
    market: shuffle(discard.slice(0, -1)),
    discard: [topCard],
  };
}

function drawCards(market: WhotCard[], discard: WhotCard[], count: number) {
  let nextMarket = [...market];
  let nextDiscard = [...discard];
  const drawn: WhotCard[] = [];

  for (let i = 0; i < count; i += 1) {
    if (!nextMarket.length) {
      const recycled = recycleMarket(nextMarket, nextDiscard);
      nextMarket = recycled.market;
      nextDiscard = recycled.discard;
    }
    const nextCard = nextMarket.shift();
    if (!nextCard) break;
    drawn.push(nextCard);
  }

  return { drawn, market: nextMarket, discard: nextDiscard };
}

function describeCard(card: WhotCard) {
  if (card.shape === 'whot') return 'Whot';
  return `${card.value} ${shapeLabel(card.shape)}`;
}

function shapeLabel(shape: DemandShape) {
  return SHAPE_LOOKUP[shape].label;
}

function shapeSymbol(shape: WhotShape) {
  return shape === 'whot' ? 'W' : SHAPE_LOOKUP[shape].symbol;
}

function calloutFor(card: WhotCard) {
  if (card.shape === 'whot') return 'Call a shape';
  if (card.value === 1) return 'Hold on';
  if (card.value === 2) return 'Pick two';
  if (card.value === 5) return 'Pick three';
  if (card.value === 8) return 'Suspension';
  if (card.value === 14) return 'General market';
  return null;
}

function countHandPoints(hand: WhotCard[]) {
  return hand.reduce((sum, card) => sum + card.scoreValue, 0);
}

function demandShapeForHand(hand: WhotCard[], fallback: DemandShape = 'circle'): DemandShape {
  const counts = new Map<DemandShape, number>();
  SHAPES.forEach((shape) => counts.set(shape.id, 0));

  hand.forEach((card) => {
    if (card.shape !== 'whot') counts.set(card.shape, (counts.get(card.shape) || 0) + 1);
  });

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[1] ? ranked[0][0] : fallback;
}

function isPlayableCard(card: WhotCard, state: WhotState) {
  if (state.pendingKind) return card.value === state.pendingKind;
  if (card.shape === 'whot') return true;
  if (state.demandedShape) return card.shape === state.demandedShape;
  const topCard = getTopCard(state);
  return card.shape === topCard.shape || card.value === topCard.value;
}

function addHistory(history: string[], entry: string) {
  return [entry, ...history].slice(0, 6);
}

function opponentOf(actor: TurnSide): TurnSide {
  return actor === 'player' ? 'bot' : 'player';
}

function applyDraw(state: WhotState, actor: TurnSide, labels: TurnLabels) {
  const drawCount = state.pendingDraw || 1;
  const drawResult = drawCards(state.market, state.discard, drawCount);
  const key = actor === 'player' ? 'playerHand' : 'botHand';
  const actorName = labels[actor];
  const nextTurn = opponentOf(actor);
  const reason = state.pendingDraw ? `picked ${drawCount}` : 'drew from market';
  const nextHand = sortHand([...state[key], ...drawResult.drawn]);
  const entry = `${actorName} ${reason}.`;

  return {
    ...state,
    [key]: nextHand,
    market: drawResult.market,
    discard: drawResult.discard,
    currentTurn: nextTurn,
    pendingDraw: 0,
    pendingKind: null,
    message: entry,
    history: addHistory(state.history, entry),
  };
}

function applyPlay(state: WhotState, actor: TurnSide, card: WhotCard, labels: TurnLabels, demandedShape?: DemandShape): WhotState {
  const isPlayer = actor === 'player';
  const actorName = labels[actor];
  const handKey = isPlayer ? 'playerHand' : 'botHand';
  const otherKey = isPlayer ? 'botHand' : 'playerHand';
  const nextHand = sortHand(state[handKey].filter((handCard) => handCard.id !== card.id));
  const topCard = getTopCard(state);
  const nextState: WhotState = {
    ...state,
    [handKey]: nextHand,
    discard: [...state.discard, card],
    demandedShape: card.shape === 'whot' ? demandedShape || demandShapeForHand(nextHand) : null,
    pendingDraw: 0,
    pendingKind: null,
    currentTurn: opponentOf(actor),
    message: `${actorName} played ${describeCard(card)}.`,
    history: state.history,
    winner: null,
  };

  let message = `${actorName} played ${describeCard(card)}.`;

  if (card.shape === 'whot') {
    message = `${actorName} played Whot and called ${shapeLabel(nextState.demandedShape!)}.`;
  } else if (card.value === 1) {
    nextState.currentTurn = actor;
    message = `${actorName} played Hold On and keeps the floor.`;
  } else if (card.value === 8) {
    nextState.currentTurn = actor;
    message = `${actorName} played Suspension. Turn skipped.`;
  } else if (card.value === 14) {
    const drawResult = drawCards(state.market, state.discard, 1);
    nextState.market = drawResult.market;
    nextState.discard = [...drawResult.discard, card];
    nextState[otherKey] = sortHand([...state[otherKey], ...drawResult.drawn]);
    nextState.currentTurn = actor;
    message = `${actorName} played General Market. Opponent picks one.`;
  } else if (card.value === 2) {
    nextState.pendingDraw = state.pendingDraw + 2;
    nextState.pendingKind = 2;
    message = `${actorName} played Pick Two. Stack is ${nextState.pendingDraw}.`;
  } else if (card.value === 5) {
    nextState.pendingDraw = state.pendingDraw + 3;
    nextState.pendingKind = 5;
    message = `${actorName} played Pick Three. Stack is ${nextState.pendingDraw}.`;
  } else if (state.demandedShape) {
    message = `${actorName} answered the ${shapeLabel(state.demandedShape)} call with ${describeCard(card)}.`;
  } else if (topCard.value === card.value && topCard.shape !== card.shape) {
    message = `${actorName} matched on number with ${describeCard(card)}.`;
  }

  nextState.message = message;
  nextState.history = addHistory(state.history, message);

  if (nextHand.length === 0) {
    nextState.winner = actor;
    nextState.message = actor === 'player'
      ? 'Check up — you emptied your hand.'
      : `${labels.bot} checked up first.`;
    nextState.history = addHistory(nextState.history, nextState.message);
  }

  return nextState;
}

function scoreBotMove(card: WhotCard, state: WhotState) {
  let score = card.scoreValue;
  if (card.shape === 'whot') score += state.playerHand.length <= 2 ? 40 : 24;
  if (card.value === 14) score += 18;
  if (card.value === 1 || card.value === 8) score += 16;
  if (card.value === 2 || card.value === 5) score += state.playerHand.length <= 2 ? 26 : 10;
  if (state.demandedShape && card.shape === state.demandedShape) score += 4;
  return score;
}

function performBotTurn(state: WhotState, labels: TurnLabels) {
  if (state.winner) return state;

  const playable = state.botHand.filter((card) => isPlayableCard(card, state));
  if (!playable.length) return applyDraw(state, 'bot', labels);

  const choice = [...playable].sort((a, b) => scoreBotMove(b, state) - scoreBotMove(a, state))[0];
  if (choice.shape === 'whot') {
    const calledShape = demandShapeForHand(state.botHand.filter((card) => card.id !== choice.id), 'square');
    return applyPlay(state, 'bot', choice, labels, calledShape);
  }
  return applyPlay(state, 'bot', choice, labels);
}

function WhotCardFace({
  card,
  disabled,
  playable,
  concealed,
  onClick,
}: {
  card: WhotCard;
  disabled?: boolean;
  playable?: boolean;
  concealed?: boolean;
  onClick?: () => void;
}) {
  if (concealed) {
    return (
      <div className="w-[74px] h-[104px] rounded-[18px] border border-zinc-300 bg-[linear-gradient(135deg,#1b1918,#3b3430)] text-white shadow-sm grid place-items-center">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-300">Whot</div>
          <div className="mt-1 text-[24px] font-[800]">?</div>
        </div>
      </div>
    );
  }

  const shapeStyle = card.shape === 'whot'
    ? { bg: 'from-zinc-900 via-zinc-800 to-zinc-700', border: 'border-zinc-700', ink: 'text-zinc-50', label: 'Whot', symbol: 'W' }
    : { ...SHAPE_LOOKUP[card.shape], label: shapeLabel(card.shape), symbol: shapeSymbol(card.shape) };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-[78px] h-[112px] rounded-[20px] border bg-gradient-to-br p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition',
        shapeStyle.bg,
        shapeStyle.border,
        shapeStyle.ink,
        playable && 'ring-2 ring-emerald-400 translate-y-[-2px]',
        disabled ? 'opacity-60' : 'hover:translate-y-[-2px] active:translate-y-0',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-[20px] font-[800] leading-none">{card.value}</div>
        <div className="text-[18px]">{shapeStyle.symbol}</div>
      </div>
      <div className="mt-6 text-[28px] font-[780] leading-none">{shapeStyle.symbol}</div>
      <div className="mt-3 text-[11px] font-[650] uppercase tracking-[0.16em]">{shapeStyle.label}</div>
      {card.shape === 'star' && <div className="mt-1 text-[10px] opacity-80">Counts {card.scoreValue}</div>}
    </button>
  );
}

export function WhotArena({ stake, balance, challenge, user, onLockStake, onFinish, onExit }: Props) {
  const [state, setState] = React.useState<WhotState>(() => createWhotState());
  const [wildChoice, setWildChoice] = React.useState<WhotCard | null>(null);
  const [phase, setPhase] = React.useState<ArenaPhase>('setup');
  const [mode, setMode] = React.useState<MatchMode>(challenge ? 'friends' : 'solo');
  const [selectedFriendId, setSelectedFriendId] = React.useState<string>(
    challenge?.invitedUserId ?? challenge?.invitedUsers?.[0]?.id ?? mockOnlinePlayers.find((player) => player.game === 'whot')?.id ?? '',
  );
  const [stakeInput, setStakeInput] = React.useState<number>(challenge?.stake ?? (stake > 0 ? stake : 4));
  const [setupNote, setSetupNote] = React.useState<string>(
    challenge ? 'Review the table and lock your seat to begin.' : 'Choose solo or friends, set your stake, and start the round.',
  );
  const [activeStake, setActiveStake] = React.useState<number>(challenge?.stake ?? stake);
  const finishedRef = React.useRef(false);

  const friendPool = React.useMemo(
    () => mockOnlinePlayers.filter((player) => player.game === 'whot'),
    [],
  );
  const selectedFriend = React.useMemo(
    () => friendPool.find((player) => player.id === selectedFriendId),
    [friendPool, selectedFriendId],
  );
  const humanOnly = !!challenge || mode === 'friends';
  const names = React.useMemo(() => {
    if (challenge) {
      if (challenge.creator.id === user.id) {
        const opponent = challenge.participants?.find((participant) => participant.id !== user.id);
        const firstInvite = challenge.invitedUsers?.[0];
        return {
          player: { name: user.displayName, avatar: user.avatar, rating: user.rating },
          bot: { name: challenge.invitedUserName || opponent?.name || firstInvite?.name || 'Friend', avatar: opponent?.avatar || firstInvite?.avatar || '🤝', rating: opponent?.rating || firstInvite?.rating || 1680 },
        };
      }
      return {
        player: { name: user.displayName, avatar: user.avatar, rating: user.rating },
        bot: { name: challenge.creator.name, avatar: challenge.creator.avatar, rating: challenge.creator.rating },
      };
    }

    if (mode === 'friends') {
      return {
        player: { name: user.displayName, avatar: user.avatar, rating: user.rating },
        bot: { name: selectedFriend?.name || 'Friend', avatar: selectedFriend?.avatar || '🤝', rating: selectedFriend?.rating || 1680 },
      };
    }

    return {
      player: { name: user.displayName, avatar: user.avatar, rating: user.rating },
      bot: { name: 'House AI', avatar: '🤖', rating: 1718 },
    };
  }, [challenge, mode, selectedFriend, user]);
  const turnLabels = React.useMemo<TurnLabels>(
    () => ({ player: names.player.name, bot: names.bot.name }),
    [names],
  );
  const viewerSide: TurnSide = humanOnly ? state.currentTurn : 'player';
  const visibleHand = viewerSide === 'player' ? state.playerHand : state.botHand;
  const hiddenHandCount = viewerSide === 'player' ? state.botHand.length : state.playerHand.length;
  const opponentSide: TurnSide = viewerSide === 'player' ? 'bot' : 'player';
  const viewerName = viewerSide === 'player' ? names.player.name : names.bot.name;
  const viewerAvatar = viewerSide === 'player' ? names.player.avatar : names.bot.avatar;
  const opponentName = opponentSide === 'player' ? names.player.name : names.bot.name;
  const opponentAvatar = opponentSide === 'player' ? names.player.avatar : names.bot.avatar;
  const turnOwnerName = state.currentTurn === 'player' ? names.player.name : names.bot.name;
  const turnOwnerAvatar = state.currentTurn === 'player' ? names.player.avatar : names.bot.avatar;

  const topCard = getTopCard(state);
  const playableCardIds = React.useMemo(() => {
    if (state.winner || wildChoice || phase !== 'playing') return new Set<string>();
    const hand = viewerSide === 'player' ? state.playerHand : state.botHand;
    return new Set(hand.filter((card) => isPlayableCard(card, state)).map((card) => card.id));
  }, [phase, state, viewerSide, wildChoice]);

  React.useEffect(() => {
    if (humanOnly || state.currentTurn !== 'bot' || state.winner || wildChoice || phase !== 'playing') return;
    const timer = setTimeout(() => {
      setState((prev) => performBotTurn(prev, turnLabels));
    }, 950);
    return () => clearTimeout(timer);
  }, [humanOnly, phase, state.currentTurn, state.winner, state.botHand, state.demandedShape, state.pendingDraw, state.pendingKind, turnLabels, wildChoice]);

  React.useEffect(() => {
    if (!state.winner || finishedRef.current) return;
    finishedRef.current = true;
    const timer = setTimeout(() => {
      const won = state.winner === 'player';
      const score = won ? countHandPoints(state.botHand) : countHandPoints(state.playerHand);
      const pot = activeStake > 0 ? activeStake * 2 * 0.93 : 0;
      onFinish({
        score,
        won,
        payout: won ? pot : 0,
        msg: state.message,
        stake: activeStake,
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [activeStake, onFinish, state]);

  const drawLabel = state.pendingDraw ? `Pick ${state.pendingDraw}` : 'Draw market';

  const launchMatch = React.useCallback(() => {
    const desiredStake = Math.max(0, Number(stakeInput) || 0);

    if (!challenge && mode === 'friends' && !selectedFriendId) {
      setSetupNote('Choose a friend before opening the table.');
      return;
    }

    if (desiredStake > 0 && !onLockStake(desiredStake)) {
      setSetupNote(`You need ${money(desiredStake)} available to lock this table.`);
      return;
    }

    finishedRef.current = false;
    setState(createWhotState());
    setWildChoice(null);
    setActiveStake(desiredStake);
    setPhase(humanOnly ? 'handoff' : 'playing');
    setSetupNote(
      challenge
        ? 'Stake locked. Pass the device to the opening player and reveal the hand.'
        : mode === 'solo'
          ? 'Solo table ready. The opening hand is live.'
          : `${selectedFriend?.name || 'Your friend'} joined the table. Pass the device to begin.`,
    );
  }, [challenge, humanOnly, mode, onLockStake, selectedFriend?.name, selectedFriendId, stakeInput]);

  const handlePlayerCard = (card: WhotCard) => {
    if (state.winner || wildChoice || phase !== 'playing') return;
    if (!isPlayableCard(card, state)) return;
    if (card.shape === 'whot') {
      setWildChoice(card);
      return;
    }
    const actor = humanOnly ? viewerSide : 'player';
    const nextState = applyPlay(state, actor, card, turnLabels);
    setState(nextState);
    if (humanOnly && !nextState.winner && nextState.currentTurn !== actor) setPhase('handoff');
  };

  const handleDemandShape = (shape: DemandShape) => {
    if (!wildChoice) return;
    const card = wildChoice;
    setWildChoice(null);
    const actor = humanOnly ? viewerSide : 'player';
    const nextState = applyPlay(state, actor, card, turnLabels, shape);
    setState(nextState);
    if (humanOnly && !nextState.winner && nextState.currentTurn !== actor) setPhase('handoff');
  };

  const handleDraw = () => {
    if (state.winner || wildChoice || phase !== 'playing') return;
    const actor = humanOnly ? viewerSide : 'player';
    const nextState = applyDraw(state, actor, turnLabels);
    setState(nextState);
    if (humanOnly && !nextState.winner) setPhase('handoff');
  };

  if (phase === 'setup') {
    const projectedPot = stakeInput > 0 ? stakeInput * 2 : 0;

    return (
      <GameScreen className="max-w-5xl">
        <GameHero
          accent="emerald"
          eyebrow="Whot!"
          title="Choose your Whot table."
          subtitle="Launch a solo round against the computer or open a friend-backed table with private hand reveals and the same polished arena styling used across the rest of the app."
          onExit={onExit}
          exitLabel="Leave table"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="gold">{challenge ? 'Challenge table' : 'Quick start'}</Badge>
            <Badge variant="emerald">Wallet-backed stake</Badge>
            <Badge variant="default">{humanOnly ? 'Friends-enabled' : 'Solo AI ready'}</Badge>
          </div>
        </GameHero>

        <div className="grid lg:grid-cols-[minmax(360px,1fr)_340px] gap-6 items-start">
          <GamePanel className="p-5 sm:p-6">
            {!challenge && (
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMode('solo')}
                  className={cn(
                    'rounded-[24px] border p-4 text-left text-white transition',
                    mode === 'solo'
                      ? 'border-emerald-300/35 bg-gradient-to-br from-emerald-500/30 via-teal-500/18 to-cyan-500/10 shadow-[0_18px_50px_rgba(16,185,129,0.18)]'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                  )}
                >
                  <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Single</div>
                  <div className="mt-2 text-[22px] font-[720] tracking-tight">Play the computer</div>
                  <div className="mt-2 text-[13.4px] leading-6 text-slate-300">One stake, one AI opponent, and a fast head-to-head Whot table.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('friends')}
                  className={cn(
                    'rounded-[24px] border p-4 text-left text-white transition',
                    mode === 'friends'
                      ? 'border-emerald-300/35 bg-gradient-to-br from-cyan-500/22 via-emerald-500/18 to-teal-500/10 shadow-[0_18px_50px_rgba(6,182,212,0.18)]'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                  )}
                >
                  <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Friends</div>
                  <div className="mt-2 text-[22px] font-[720] tracking-tight">Play with someone</div>
                  <div className="mt-2 text-[13.4px] leading-6 text-slate-300">Invite a friend from the Whot lobby and lock the table before the first reveal.</div>
                </button>
              </div>
            )}

            <div className="mt-5 grid md:grid-cols-2 gap-3">
              <Field
                label={humanOnly ? 'Stake per player (USD)' : 'Solo stake (USD)'}
                type="number"
                value={stakeInput}
                className={gameFieldClass}
                onChange={(event) => setStakeInput(Math.max(0, parseFloat(event.target.value) || 0))}
              />
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Table type</div>
                <div className="mt-1">{humanOnly ? 'Friends table' : 'Solo table against the computer'}</div>
                <div className="mt-2 text-[12.8px] leading-5 text-slate-400">{challenge ? `Matched with ${names.bot.name}.` : humanOnly ? 'Each player locks the same entry amount before cards are shown.' : 'The computer sits instantly once you lock your stake.'}</div>
              </div>
            </div>

            {humanOnly && !challenge && (
              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <label className="block text-[12.8px]">
                  <div className="mb-1.5 font-[550] text-slate-300">Invite friend</div>
                  <select
                    value={selectedFriendId}
                    onChange={(event) => setSelectedFriendId(event.target.value)}
                    className={gameSelectClass}
                  >
                    {friendPool.map((player) => (
                      <option key={player.id} value={player.id} className="bg-slate-900 text-white">
                        {player.name} • {player.rating} • {player.stakePref}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={gameInfoCardClass}>
                  <div className="font-[650] text-white">Friend seat</div>
                  <div className="mt-1">{selectedFriend ? `${selectedFriend.avatar} ${selectedFriend.name} is first in line for this table.` : 'Choose who should sit across from you.'}</div>
                  <div className="mt-2 text-[12.8px] leading-5 text-slate-400">For open or shareable invites, use the Challenges tab to publish a public room.</div>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <div className="grid sm:grid-cols-4 gap-3 text-[13px]">
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Your wallet</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{money(balance)}</div>
                </div>
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Players</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">2 seats</div>
                </div>
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Projected pot</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{projectedPot ? money(projectedPot) : 'Practice'}</div>
                </div>
                <div className={gameInfoTileClass}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Winner payout</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">{projectedPot ? money(projectedPot * 0.93) : '—'}</div>
                </div>
              </div>
              <div className="mt-3 text-[12.8px] text-slate-400">{setupNote}</div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button className="flex-1 justify-center" onClick={launchMatch}>
                {challenge ? 'Lock seat & start' : humanOnly ? 'Open friends table' : 'Start solo match'}
              </Button>
              <Button variant="secondary" onClick={onExit}>Back</Button>
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="font-[680] text-white">What this setup gives you</div>
            <div className="mt-3 space-y-3 text-[13.4px]">
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Solo or friends</div>
                <div className="mt-1 leading-6 text-slate-300">You can launch a quick round against the computer or switch to a friend-backed Whot table first.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Stake preview</div>
                <div className="mt-1 leading-6 text-slate-300">The setup shows what each player is locking, the total pot, and the winner payout after rake.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Private hands</div>
                <div className="mt-1 leading-6 text-slate-300">Friend tables still protect each hand with a reveal step before the next player sees their cards.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Challenge support</div>
                <div className="mt-1 leading-6 text-slate-300">If a friend accepts your invite from the Challenges tab, this same screen becomes the final lock-and-start step.</div>
              </div>
            </div>
          </GamePanel>
        </div>
      </GameScreen>
    );
  }

  return (
    <GameScreen className="max-w-6xl">
      <GameHero
        accent="emerald"
        eyebrow="Whot!"
        title={humanOnly ? 'Friends table live' : 'Solo round live'}
        subtitle="A sharper Whot table with cleaner side panels, protected hand reveals, and a richer in-game presentation."
        onExit={onExit}
        exitLabel="Leave table"
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="gold">Stake {activeStake ? money(activeStake) : 'Practice'}</Badge>
          <Badge variant="default">{humanOnly ? 'Friends table' : 'House AI'}</Badge>
          <Badge variant="emerald">{turnOwnerAvatar} {turnOwnerName} on move</Badge>
        </div>
      </GameHero>

      <div className="grid lg:grid-cols-[minmax(360px,1.15fr)_360px] gap-6 items-start">
        <GamePanel className="p-5 sm:p-6">
          {humanOnly && phase === 'handoff' && (
            <div className="mb-5 rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4">
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Pass device</div>
              <div className="mt-2 text-[24px] tracking-tight text-white" style={{ fontFamily: 'Fraunces, serif', fontWeight: 620 }}>{viewerAvatar} {viewerName}'s hand is next.</div>
              <div className="mt-2 text-[13.4px] leading-6 text-slate-300">Private cards stay hidden until the next player reveals them.</div>
              <div className="mt-4"><Button onClick={() => setPhase('playing')}>Reveal hand</Button></div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[12.5px] uppercase tracking-[0.18em] text-slate-400">Opponent</div>
              <div className="text-[21px] font-[700] tracking-tight text-white">{opponentAvatar} {opponentName} • {opponentSide === 'player' ? names.player.rating : names.bot.rating}</div>
            </div>
            <Pill className={gamePillClass}>{hiddenHandCount} cards in hand</Pill>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: Math.min(8, hiddenHandCount) }).map((_, index) => (
              <WhotCardFace key={index} card={visibleHand[index] || visibleHand[0] || topCard} concealed />
            ))}
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.18),rgba(8,17,33,0.96)_62%)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12.5px] uppercase tracking-[0.18em] text-slate-400">Live call</div>
                <div className="text-[18px] font-[700] tracking-tight text-white">
                  {state.demandedShape ? `${shapeLabel(state.demandedShape)} demanded` : describeCard(topCard)}
                </div>
              </div>
              {state.pendingDraw > 0 && (
                <Pill className="border border-rose-300/20 bg-rose-500/14 text-rose-200">
                  Stack {state.pendingDraw}
                </Pill>
              )}
            </div>

            <div className="mt-5 grid sm:grid-cols-[1fr_1fr_1fr] gap-4 items-center">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Market</div>
                <div className="mt-3 flex items-end gap-3">
                  <div className="w-[84px] h-[116px] rounded-[20px] border border-zinc-300 bg-[linear-gradient(135deg,#10343a,#0f766e)] text-white grid place-items-center shadow-sm">
                    <div className="text-center">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-100">Deck</div>
                      <div className="mt-2 text-[26px] font-[800]">{state.market.length}</div>
                    </div>
                  </div>
                  <div className="text-[12.8px] text-slate-400">Draw when you can’t match the call.</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Call card</div>
                <div className="mt-3 flex justify-center">
                  <WhotCardFace card={topCard} disabled />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Turn</div>
                <div className="mt-3 text-[26px] font-[760] tracking-tight text-white">
                  {state.winner ? (state.winner === 'player' ? `${names.player.name} won` : `${names.bot.name} won`) : `${turnOwnerAvatar} ${turnOwnerName} on move`}
                </div>
                <div className="mt-2 text-[12.8px] text-slate-400">{state.message}</div>
              </div>
            </div>

            {wildChoice && (
              <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-4">
                <div className="text-[13px] font-[650] text-white">Whot played. Call the next shape.</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SHAPES.map((shape) => (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => handleDemandShape(shape.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-[650] transition hover:translate-y-[-1px]',
                        shape.border,
                        shape.ink,
                        'bg-gradient-to-br',
                        shape.bg,
                      )}
                    >
                      <span>{shape.symbol}</span>
                      {shape.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-[12.5px] uppercase tracking-[0.18em] text-slate-400">Hand in play</div>
                <div className="text-[13px] text-slate-400">{viewerAvatar} {viewerName} • {humanOnly ? 'Only the active player can view these cards.' : 'Match on shape or number. Whot is wild.'}</div>
              </div>
              <Button onClick={handleDraw} disabled={phase !== 'playing' || !!state.winner || !!wildChoice} className="justify-center">
                {drawLabel}
              </Button>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-max">
                {visibleHand.map((card) => (
                  <WhotCardFace
                    key={card.id}
                    card={card}
                    playable={playableCardIds.has(card.id)}
                    disabled={phase !== 'playing' || !!state.winner || !!wildChoice}
                    onClick={() => handlePlayerCard(card)}
                  />
                ))}
              </div>
            </div>
          </div>
        </GamePanel>

        <div className="space-y-4">
          <GamePanel className="p-5">
            <div className="mb-3 font-[680] text-white">Table pulse</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] py-3">
                <div className="text-[21px] font-[760] tracking-tight text-white">{state.playerHand.length}</div>
                <div className="text-[11.8px] text-slate-500">{names.player.name}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] py-3">
                <div className="text-[21px] font-[760] tracking-tight text-white">{state.botHand.length}</div>
                <div className="text-[11.8px] text-slate-500">{names.bot.name}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] py-3">
                <div className="text-[21px] font-[760] tracking-tight text-white">{countHandPoints(state.playerHand)}</div>
                <div className="text-[11.8px] text-slate-500">{names.player.name} deadwood</div>
              </div>
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="mb-3 font-[680] text-white">Quick rules</div>
            <div className="space-y-2 text-[13.5px] text-slate-300">
              <div><b>1</b> Hold On: you play again.</div>
              <div><b>2</b> Pick Two: stackable defense with another 2.</div>
              <div><b>5</b> Pick Three: stackable defense with another 5.</div>
              <div><b>8</b> Suspension: skip the next turn.</div>
              <div><b>14</b> General Market: opponent picks one, you keep playing.</div>
              <div><b>20</b> Whot: wild card that calls the next shape.</div>
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="mb-3 font-[680] text-white">Recent calls</div>
            <div className="space-y-2 text-[13.3px]">
              {state.history.map((entry, index) => (
                <div key={`${entry}-${index}`} className="rounded-[16px] border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200">
                  {entry}
                </div>
              ))}
            </div>
          </GamePanel>

          <GamePanel className="border-emerald-300/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(8,17,33,0.92))] p-5">
            <div className="font-[680] text-white">Round scoring</div>
            <div className="mt-2 text-[13.2px] leading-6 text-slate-300">
              Win by checking up first. Round score is the deadwood left in the loser’s hand, with star cards counting double just like standard Whot.
            </div>
            <div className="mt-3 text-[12.8px] text-slate-400">
              Practice uses one fast round. Stake mode settles the same 7% platform rake as the other games.
            </div>
          </GamePanel>
        </div>
      </div>
    </GameScreen>
  );
}
