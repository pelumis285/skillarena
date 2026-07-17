import React from 'react';
import { GameChat } from '../components/GameChat';
import { Badge, Button, Pill } from '../components/ui';
import { GameHero, GamePanel, GameScreen, gamePillClass } from '../components/GameShell';
import { cn, money } from '../lib/utils';
import { buildScrabbleBag, drawPlayableScrabbleTiles, localWordValid, playableRackWords, refillPlayableScrabbleRack } from '../lib/wordBank';
import type { Challenge, User } from '../lib/types';

type Props = {
  stake: number;
  challenge?: Challenge;
  user: User;
  onCreditRevealFee: (amount: number, msg: string) => void;
  onFinish: (result:{score:number, won:boolean, payout:number, msg?:string})=>void;
  onExit: ()=>void;
};

type Tile = {
  id: string;
  letter: string;
  value: number;
};

type Cell = {
  tile: Tile | null;
  locked: boolean;
  owner: number | null;
};

type Premium = 'TW' | 'DW' | 'TL' | 'DL' | 'STAR' | null;
type Direction = 'horizontal' | 'vertical';

const BOARD_SIZE = 15;
const CENTER = 7;
const HAND_SIZE = 7;

const PREMIUMS: Record<string, Premium> = {
  '0-0': 'TW', '0-7': 'TW', '0-14': 'TW', '7-0': 'TW', '7-14': 'TW', '14-0': 'TW', '14-7': 'TW', '14-14': 'TW',
  '1-1': 'DW', '2-2': 'DW', '3-3': 'DW', '4-4': 'DW', '10-10': 'DW', '11-11': 'DW', '12-12': 'DW', '13-13': 'DW',
  '1-13': 'DW', '2-12': 'DW', '3-11': 'DW', '4-10': 'DW', '10-4': 'DW', '11-3': 'DW', '12-2': 'DW', '13-1': 'DW',
  '7-7': 'STAR',
  '1-5': 'TL', '1-9': 'TL', '5-1': 'TL', '5-5': 'TL', '5-9': 'TL', '5-13': 'TL', '9-1': 'TL', '9-5': 'TL', '9-9': 'TL', '9-13': 'TL', '13-5': 'TL', '13-9': 'TL',
  '0-3': 'DL', '0-11': 'DL', '2-6': 'DL', '2-8': 'DL', '3-0': 'DL', '3-7': 'DL', '3-14': 'DL', '6-2': 'DL', '6-6': 'DL', '6-8': 'DL', '6-12': 'DL',
  '7-3': 'DL', '7-11': 'DL', '8-2': 'DL', '8-6': 'DL', '8-8': 'DL', '8-12': 'DL', '11-0': 'DL', '11-7': 'DL', '11-14': 'DL', '12-6': 'DL', '12-8': 'DL', '14-3': 'DL', '14-11': 'DL',
};

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => ({
    tile: null,
    locked: false,
    owner: null,
  } satisfies Cell)));
}

function roomPlayers(challenge: Challenge | undefined, user: User) {
  if (!challenge) {
    return [
      { id: user.id, name: user.displayName, avatar: user.avatar, rating: user.rating },
      { id: 'friend-seat', name: 'Friend', avatar: '🤝', rating: 1600 },
    ];
  }

  if (challenge.creator.id === user.id) {
    const opponent = challenge.participants?.find((participant) => participant.id !== user.id);
    const firstInvite = challenge.invitedUsers?.[0];
    return [
      { id: user.id, name: user.displayName, avatar: user.avatar, rating: user.rating },
      { id: challenge.invitedUserId || opponent?.id || firstInvite?.id || 'friend-seat', name: challenge.invitedUserName || opponent?.name || firstInvite?.name || 'Friend', avatar: opponent?.avatar || firstInvite?.avatar || '🤝', rating: opponent?.rating || firstInvite?.rating || 1600 },
    ];
  }

  return [
    { id: user.id, name: user.displayName, avatar: user.avatar, rating: user.rating },
    { id: challenge.creator.id, name: challenge.creator.name, avatar: challenge.creator.avatar, rating: challenge.creator.rating },
  ];
}

function premiumAt(row: number, col: number) {
  return PREMIUMS[`${row}-${col}`] || null;
}

function premiumClasses(premium: Premium) {
  if (premium === 'TW') return 'bg-[#f8d6d0] text-[#8f2f1f]';
  if (premium === 'DW' || premium === 'STAR') return 'bg-[#ffe7bf] text-[#8a5300]';
  if (premium === 'TL') return 'bg-[#d6ecff] text-[#0a4f8b]';
  if (premium === 'DL') return 'bg-[#e4f4d8] text-[#396920]';
  return 'bg-white text-zinc-400';
}

function hasLockedTiles(board: Cell[][]) {
  return board.some((row) => row.some((cell) => cell.locked));
}

function gatherWord(board: Cell[][], placements: Map<string, Tile>, row: number, col: number, direction: Direction) {
  const deltaRow = direction === 'vertical' ? 1 : 0;
  const deltaCol = direction === 'horizontal' ? 1 : 0;

  let startRow = row;
  let startCol = col;
  while (startRow - deltaRow >= 0 && startCol - deltaCol >= 0) {
    const prevKey = `${startRow - deltaRow}-${startCol - deltaCol}`;
    const previous = placements.get(prevKey) || board[startRow - deltaRow]?.[startCol - deltaCol]?.tile;
    if (!previous) break;
    startRow -= deltaRow;
    startCol -= deltaCol;
  }

  const letters: Array<{ row: number; col: number; tile: Tile; isNew: boolean }> = [];
  let cursorRow = startRow;
  let cursorCol = startCol;
  while (cursorRow < BOARD_SIZE && cursorCol < BOARD_SIZE) {
    const key = `${cursorRow}-${cursorCol}`;
    const tile = placements.get(key) || board[cursorRow][cursorCol].tile;
    if (!tile) break;
    letters.push({ row: cursorRow, col: cursorCol, tile, isNew: placements.has(key) });
    cursorRow += deltaRow;
    cursorCol += deltaCol;
  }

  return letters;
}

function computeWordScore(wordTiles: Array<{ row: number; col: number; tile: Tile; isNew: boolean }>) {
  let score = 0;
  let multiplier = 1;
  for (const entry of wordTiles) {
    const premium = premiumAt(entry.row, entry.col);
    let tileScore = entry.tile.value;
    if (entry.isNew && premium === 'DL') tileScore *= 2;
    if (entry.isNew && premium === 'TL') tileScore *= 3;
    if (entry.isNew && (premium === 'DW' || premium === 'STAR')) multiplier *= 2;
    if (entry.isNew && premium === 'TW') multiplier *= 3;
    score += tileScore;
  }
  return score * multiplier + (wordTiles.filter((entry) => entry.isNew).length >= 7 ? 50 : 0);
}

export function ScrabbleSocial({ stake, challenge, user, onCreditRevealFee, onFinish, onExit }: Props) {
  const players = React.useMemo(() => roomPlayers(challenge, user), [challenge, user]);
  const localUserIndex = 0;
  const [board, setBoard] = React.useState<Cell[][]>(() => createBoard());
  const [{ bag, racks }, setBagState] = React.useState(() => {
    const seededBag = buildScrabbleBag();
    const first = drawPlayableScrabbleTiles(seededBag, HAND_SIZE);
    const second = drawPlayableScrabbleTiles(first.bag, HAND_SIZE);
    return { bag: second.bag, racks: [first.tiles, second.tiles] as Tile[][] };
  });
  const [scores, setScores] = React.useState([0, 0]);
  const [turnIndex, setTurnIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<'handoff' | 'playing'>('playing');
  const [direction, setDirection] = React.useState<Direction>('horizontal');
  const [selectedTileId, setSelectedTileId] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<{ row: number; col: number }>({ row: CENTER, col: CENTER });
  const [placements, setPlacements] = React.useState<Map<string, Tile>>(() => new Map());
  const [note, setNote] = React.useState('Tap a tile, then a square to build a word.');
  const [incomingRevealOffer, setIncomingRevealOffer] = React.useState<{ amount: number; rackOwnerIndex: number } | null>({ amount: 3, rackOwnerIndex: localUserIndex });

  const currentRack = racks[turnIndex] || [];
  const currentPlayer = players[turnIndex];
  const boardStarted = React.useMemo(() => hasLockedTiles(board), [board]);
  const rackIdeas = React.useMemo(() => playableRackWords(currentRack.map((tile) => tile.letter), 6), [currentRack]);

  React.useEffect(() => {
    if (turnIndex === localUserIndex && !incomingRevealOffer) {
      setIncomingRevealOffer({ amount: 2 + ((scores[1] % 3) * 2), rackOwnerIndex: localUserIndex });
    }
  }, [incomingRevealOffer, localUserIndex, scores, turnIndex]);

  React.useEffect(() => {
    if (phase !== 'playing' || placements.size) return;
    const headline = boardStarted
      ? `${currentPlayer.name} to move. Build from the live board.`
      : `${currentPlayer.name} opens the board. Cover the center star.`;
    const hint = rackIdeas.length ? ` Try ${rackIdeas.slice(0, 3).join(', ')}.` : '';
    setSelectedTileId(null);
    setNote(`${headline}${hint}`);
  }, [boardStarted, currentPlayer.name, phase, placements.size, rackIdeas]);

  const handleBoardClick = (row: number, col: number) => {
    if (phase !== 'playing') return;
    const key = `${row}-${col}`;
    if (placements.has(key)) {
      const tile = placements.get(key)!;
      setBagState((state) => ({
        ...state,
        racks: state.racks.map((rack, index) => index === turnIndex ? [...rack, tile] : rack),
      }));
      const nextPlacements = new Map(placements);
      nextPlacements.delete(key);
      setPlacements(nextPlacements);
      return;
    }
    if (!selectedTileId || board[row][col].tile) {
      setCursor({ row, col });
      return;
    }
    const tile = currentRack.find((rackTile) => rackTile.id === selectedTileId);
    if (!tile) return;
    setBagState((state) => ({
      ...state,
      racks: state.racks.map((rack, index) => index === turnIndex ? rack.filter((rackTile) => rackTile.id !== selectedTileId) : rack),
    }));
    const nextPlacements = new Map(placements);
    nextPlacements.set(key, tile);
    setPlacements(nextPlacements);
    setSelectedTileId(null);
    const nextCursor = direction === 'horizontal'
      ? { row, col: Math.min(BOARD_SIZE - 1, col + 1) }
      : { row: Math.min(BOARD_SIZE - 1, row + 1), col };
    setCursor(nextCursor);
  };

  const commitTurn = () => {
    if (!placements.size) {
      setNote('Place at least one tile first.');
      return;
    }

    const coordinates = [...placements.keys()].map((key) => key.split('-').map(Number) as [number, number]);
    const sameRow = coordinates.every(([row]) => row === coordinates[0][0]);
    const sameCol = coordinates.every(([, col]) => col === coordinates[0][1]);
    if (!sameRow && !sameCol) {
      setNote('Tiles must stay in one row or one column.');
      return;
    }

    const lineDirection: Direction = sameRow ? 'horizontal' : 'vertical';
    const anchor = coordinates.sort((left, right) => (sameRow ? left[1] - right[1] : left[0] - right[0]))[0];
    const wordTiles = gatherWord(board, placements, anchor[0], anchor[1], lineDirection);
    const word = wordTiles.map((entry) => entry.tile.letter).join('');

    if (!hasLockedTiles(board) && !placements.has(`${CENTER}-${CENTER}`)) {
      setNote('Opening word must cover the center star.');
      return;
    }
    if (word.length < 2) {
      setNote('Build a full word on the board.');
      return;
    }
    if (wordTiles.filter((entry) => entry.isNew).length !== placements.size) {
      setNote('Your placed tiles must form one continuous word.');
      return;
    }
    if (!localWordValid(word)) {
      setNote(`"${word}" is not in the local word list.`);
      return;
    }

    const score = computeWordScore(wordTiles);
    const nextBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    placements.forEach((tile, key) => {
      const [row, col] = key.split('-').map(Number);
      nextBoard[row][col] = { tile, locked: true, owner: turnIndex };
    });

    setBoard(nextBoard);
    setScores((existing) => existing.map((value, index) => index === turnIndex ? value + score : value));
    setBagState((state) => {
      const nextRack = refillPlayableScrabbleRack(state.bag, state.racks[turnIndex], HAND_SIZE);
      return {
        bag: nextRack.bag,
        racks: state.racks.map((rack, index) => index === turnIndex ? nextRack.rack : rack),
      };
    });
    setPlacements(new Map());
    setDirection('horizontal');
    setPhase('handoff');
    setTurnIndex((value) => (value + 1) % 2);
    setCursor({ row: CENTER, col: CENTER });
    setNote(`${currentPlayer.name} played ${word} for ${score} points.`);
  };

  const settleMatch = () => {
    const playerScore = scores[0];
    const opponentScore = scores[1];
    const won = playerScore > opponentScore;
    const draw = playerScore === opponentScore;
    const pot = stake > 0 ? stake * 2 * 0.93 : 0;
    onFinish({
      score: playerScore,
      won,
      payout: draw ? stake : (won ? pot : 0),
      msg: draw ? 'Scrabble room settled as a draw.' : `${players[0].name} ${won ? 'won' : 'lost'} the board ${playerScore}–${opponentScore}.`,
    });
  };

  return (
    <GameScreen className="max-w-6xl">
      <GameHero
        accent="sky"
        eyebrow="Scrabble Social"
        title="Premium shared board"
        subtitle="A human-only Scrabble room with private racks, a shared live board, and a darker game table that now matches the rest of the app."
        onExit={onExit}
        exitLabel="Leave table"
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="purple">Stake {stake ? money(stake) : 'Practice'}</Badge>
          <Badge variant="emerald">2-player room</Badge>
          <Badge variant="default">{challenge?.inviteCode || 'Open shared board'}</Badge>
        </div>
      </GameHero>

      <div className="grid xl:grid-cols-[minmax(420px,1fr)_360px] gap-6 items-start">
        <GamePanel className="p-4 sm:p-5">
          {phase === 'handoff' && (
            <div className="mb-5 rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4">
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Next turn</div>
              <div className="mt-2 text-[24px] font-[800] tracking-[-0.05em] text-white">{players[turnIndex].avatar} {players[turnIndex].name}'s turn</div>
              <div className="mt-2 text-[13.4px] leading-6 text-slate-300">Reveal the next rack when the phone is in the next player’s hands. Invite code: {challenge?.inviteCode || 'Open room'}</div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => setPhase('playing')}>Reveal next rack</Button>
                <Button variant="secondary" onClick={settleMatch}>Settle current score</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-15 gap-[1px] rounded-[22px] border border-white/10 bg-[#cfd8e8]/18 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:gap-[2px] sm:rounded-[28px] sm:p-2" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
            {board.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
              const premium = premiumAt(rowIndex, colIndex);
              const key = `${rowIndex}-${colIndex}`;
              const pendingTile = placements.get(key);
              const shownTile = pendingTile || cell.tile;
              const activeCursor = cursor.row === rowIndex && cursor.col === colIndex;
              return (
                <button
                  key={key}
                  onClick={() => handleBoardClick(rowIndex, colIndex)}
                  className={cn(
                    'relative aspect-square rounded-[5px] border text-center transition sm:rounded-[7px]',
                    premiumClasses(premium),
                    activeCursor && phase === 'playing' && 'ring-2 ring-indigo-400/70',
                    shownTile ? 'border-slate-300 bg-white text-zinc-900 shadow-sm' : 'border-transparent',
                  )}
                >
                  {shownTile ? (
                    <div className="grid h-full place-items-center">
                      <div className="text-[11px] font-[760] leading-none sm:text-[15px]">{shownTile.letter}</div>
                      <div className="text-[7px] leading-none text-zinc-500 sm:text-[9px]">{shownTile.value}</div>
                    </div>
                  ) : (
                    <span className="text-[6px] font-[700] uppercase tracking-[0.04em] sm:text-[9px] sm:tracking-[0.08em]">{premium === 'STAR' ? '★' : premium || ''}</span>
                  )}
                </button>
              );
            }))}
          </div>

          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] text-slate-300">{note}</div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="secondary" onClick={() => setDirection((value) => value === 'horizontal' ? 'vertical' : 'horizontal')}>
                {direction === 'horizontal' ? 'Horizontal' : 'Vertical'}
              </Button>
              <Button disabled={phase !== 'playing'} onClick={commitTurn}>Commit word</Button>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[12.5px] uppercase tracking-[0.18em] text-slate-400">Active rack</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentRack.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => setSelectedTileId((current) => current === tile.id ? null : tile.id)}
                  disabled={phase !== 'playing'}
                  className={cn(
                    'h-[52px] w-[42px] rounded-[13px] border border-amber-200/65 bg-gradient-to-br from-amber-100 via-amber-50 to-orange-100 px-2 py-2 text-left text-[#34210f] shadow-[0_10px_24px_rgba(251,191,36,0.14)] transition sm:h-[62px] sm:w-[52px] sm:rounded-[16px]',
                    phase !== 'playing' && 'opacity-60',
                    selectedTileId === tile.id && 'ring-2 ring-emerald-400 -translate-y-1',
                  )}
                >
                  <div className="text-[17px] font-[780] leading-none sm:text-[21px]">{tile.letter}</div>
                  <div className="mt-1 text-[10px] text-[#6b4a1a] sm:mt-2 sm:text-[11px]">{tile.value}</div>
                </button>
              ))}
            </div>
            {phase === 'playing' && !placements.size && !!rackIdeas.length && (
              <div className="mt-3 text-[12.8px] text-slate-400">
                Playable from this rack: {rackIdeas.join(', ')}
              </div>
            )}
          </div>
        </GamePanel>

        <div className="space-y-4">
          <GamePanel className="p-5">
            <div className="mb-3 font-[680] text-white">Table score</div>
            <div className="space-y-3">
              {players.map((player, index) => (
                <div key={player.id} className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-100">{player.avatar} {player.name}</div>
                    <Pill className={gamePillClass}>{scores[index]} pts</Pill>
                  </div>
                  <div className="mt-1 text-[12.6px] text-slate-400">{index === turnIndex && phase === 'playing' ? 'On move' : 'Waiting'}</div>
                </div>
              ))}
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="mb-3 font-[680] text-white">Rack privacy</div>
            {incomingRevealOffer ? (
              <>
                <div className="text-[13.4px] leading-6 text-slate-300">Opponent offered {money(incomingRevealOffer.amount)} to peek at your letters.</div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => {
                    onCreditRevealFee(incomingRevealOffer.amount, `${players[1].name} paid to inspect your Scrabble rack.`);
                    setIncomingRevealOffer(null);
                    setNote('Reveal fee accepted. Wallet credited instantly.');
                  }}>
                    Accept offer
                  </Button>
                  <Button variant="secondary" onClick={() => setIncomingRevealOffer(null)}>Decline</Button>
                </div>
              </>
            ) : (
              <div className="text-[13.2px] leading-6 text-slate-400">No incoming rack-peek offer right now. New offers can appear on your turns.</div>
            )}
          </GamePanel>

          <GamePanel className="border-sky-300/15 bg-[linear-gradient(180deg,rgba(56,189,248,0.10),rgba(8,17,33,0.92))] p-5">
            <div className="font-[680] text-white">Room notes</div>
            <div className="mt-2 text-[13.2px] leading-6 text-slate-300">
              Scrabble is human-only here. Use Challenges to share the table link or invite code, then pass turns privately on device while realtime rooming handles the match setup.
            </div>
          </GamePanel>
          <GameChat challenge={challenge} user={user} />
        </div>
      </div>
    </GameScreen>
  );
}
