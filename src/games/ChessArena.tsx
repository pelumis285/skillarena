import React from 'react';
import { Chess, type Move } from 'chess.js';
import { Badge, Button, Field, Pill } from '../components/ui';
import { GameHero, GamePanel, GameScreen, gameFieldClass, gameInfoCardClass, gameInfoTileClass, gamePillClass, gameSelectClass } from '../components/GameShell';
import { mockOnlinePlayers } from '../lib/mock';
import { cn, money } from '../lib/utils';
import type { Challenge, MatchMode, User } from '../lib/types';

type Props = {
  stake: number;
  balance: number;
  challenge?: Challenge;
  user: User;
  onLockStake: (stake: number) => boolean;
  onFinish: (result:{score:number, won:boolean, payout:number, msg:string, stake?: number})=>void;
  onExit: ()=>void;
};

type MatchPhase = 'setup' | 'playing';

const PIECES: Record<string, string> = {
  p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚',
  P:'♙', N:'♘', B:'♗', R:'♖', Q:'♕', K:'♔',
};

const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 10000,
};

function evaluateBoard(chess: Chess) {
  return chess.board().reduce((sum, row) => sum + row.reduce((rowSum, square) => {
    if (!square) return rowSum;
    const value = PIECE_VALUES[square.type] || 0;
    return rowSum + (square.color === 'w' ? value : -value);
  }, 0), 0);
}

function scoreMove(chess: Chess, move: Move) {
  const clone = new Chess(chess.fen());
  clone.move(move);
  if (clone.isCheckmate()) return 100000;

  let score = -evaluateBoard(clone);
  if (move.captured) score += (PIECE_VALUES[move.captured] || 0) * 2;
  if (move.san.includes('+')) score += 80;
  if (['d4', 'e4', 'd5', 'e5'].includes(move.to)) score += 18;
  if (move.piece === 'n' || move.piece === 'b') score += 8;
  return score;
}

export function ChessArena({ stake, balance, challenge, user, onLockStake, onFinish, onExit }: Props) {
  const chessRef = React.useRef(new Chess());
  const [phase, setPhase] = React.useState<MatchPhase>('setup');
  const [mode, setMode] = React.useState<MatchMode>(challenge ? 'friends' : 'solo');
  const [selectedFriendId, setSelectedFriendId] = React.useState<string>(
    challenge?.invitedUserId ?? challenge?.invitedUsers?.[0]?.id ?? mockOnlinePlayers.find((player) => player.game === 'chess')?.id ?? '',
  );
  const [stakeInput, setStakeInput] = React.useState<number>(challenge?.stake ?? (stake > 0 ? stake : 5));
  const [setupNote, setSetupNote] = React.useState<string>(
    challenge ? 'Review the table and lock your seat to begin.' : 'Choose solo or friends, set your stake, and start the board.',
  );
  const [activeStake, setActiveStake] = React.useState<number>(challenge?.stake ?? stake);
  const [fen,setFen] = React.useState(chessRef.current.fen());
  const [selected,setSelected] = React.useState<string|null>(null);
  const [moves,setMoves] = React.useState<string[]>([]);
  const [whiteTime,setWhiteTime] = React.useState(300);
  const [blackTime,setBlackTime] = React.useState(300);
  const finishedRef = React.useRef(false);

  const friendPool = React.useMemo(
    () => mockOnlinePlayers.filter((player) => player.game === 'chess'),
    [],
  );
  const selectedFriend = React.useMemo(
    () => friendPool.find((player) => player.id === selectedFriendId),
    [friendPool, selectedFriendId],
  );
  const humanOnly = !!challenge || mode === 'friends';
  const players = React.useMemo(() => {
    if (challenge) {
      const opponent = challenge.creator.id === user.id
        ? challenge.participants?.find((participant) => participant.id !== user.id)
        : challenge.participants?.find((participant) => participant.id === challenge.creator.id);
      const firstInvite = challenge.invitedUsers?.[0];

      return {
        white: { name: user.displayName, avatar: user.avatar, rating: user.rating },
        black: {
          name: challenge.creator.id === user.id ? challenge.invitedUserName || opponent?.name || firstInvite?.name || 'Friend' : challenge.creator.name,
          avatar: challenge.creator.id === user.id ? opponent?.avatar || firstInvite?.avatar || '🤝' : challenge.creator.avatar,
          rating: challenge.creator.id === user.id ? opponent?.rating || firstInvite?.rating || 1600 : challenge.creator.rating,
        },
      };
    }

    if (mode === 'friends') {
      return {
        white: { name: user.displayName, avatar: user.avatar, rating: user.rating },
        black: { name: selectedFriend?.name || 'Friend', avatar: selectedFriend?.avatar || '🤝', rating: selectedFriend?.rating || 1600 },
      };
    }

    return {
      white: { name: user.displayName, avatar: user.avatar, rating: user.rating },
      black: { name: 'Grandline AI', avatar: '🤖', rating: 1822 },
    };
  }, [challenge, mode, selectedFriend, user]);
  const turn = chessRef.current.turn();
  const board = chessRef.current.board();

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (phase !== 'playing' || chessRef.current.isGameOver()) return;
      if (chessRef.current.turn() === 'w') setWhiteTime((value) => Math.max(0, value - 1));
      else setBlackTime((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== 'playing' || finishedRef.current) return;
    if (whiteTime > 0 && blackTime > 0) return;

    finishedRef.current = true;
    const whiteFlagged = whiteTime === 0;
    const won = !whiteFlagged;
    const payout = activeStake > 0 ? activeStake * 2 * 0.93 : 0;
    window.setTimeout(() => onFinish({
      score: chessRef.current.history().length,
      won,
      payout: won ? payout : 0,
      msg: whiteFlagged ? `${players.black.name} wins on time.` : `${players.white.name} wins on time.`,
      stake: activeStake,
    }), 650);
  }, [activeStake, blackTime, onFinish, phase, players.black.name, players.white.name, whiteTime]);

  const legalTargets = React.useMemo(() => {
    if (!selected) return new Set<string>();
    const options = chessRef.current.moves({ square: selected as never, verbose: true });
    return new Set(options.map((move) => move.to));
  }, [selected, fen]);

  const checkEnd = React.useCallback(() => {
    const chess = chessRef.current;
    if (!chess.isGameOver() || finishedRef.current) return false;

    finishedRef.current = true;
    let msg='Draw';
    let won = false;
    let payout = activeStake > 0 ? activeStake : 0;

    if (chess.isCheckmate()){
      const winner = chess.turn() === 'w' ? 'black' : 'white';
      won = winner === 'white';
      payout = won ? activeStake * 2 * 0.93 : 0;
      msg = won ? `Checkmate — ${players.white.name} wins` : `Checkmate — ${players.black.name} wins`;
    } else if (chess.isStalemate()) {
      msg = 'Stalemate';
    } else if (chess.isThreefoldRepetition()) {
      msg = 'Threefold repetition';
    } else if (chess.isInsufficientMaterial()) {
      msg = 'Draw by insufficient material';
    }

    window.setTimeout(() => onFinish({
      score: chess.history().length,
      won,
      payout,
      msg,
      stake: activeStake,
    }), 650);
    return true;
  }, [activeStake, onFinish, players.black.name, players.white.name]);

  const botMove = React.useCallback(() => {
    const chess = chessRef.current;
    const all = chess.moves({ verbose: true });
    if (all.length === 0) return;
    const pick = [...all].sort((left, right) => scoreMove(chess, right) - scoreMove(chess, left))[0];
    chess.move(pick);
    setFen(chess.fen());
    setMoves((value) => [...value, pick.san]);
    checkEnd();
  }, [checkEnd]);

  const resetMatch = React.useCallback(() => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setSelected(null);
    setMoves([]);
    setWhiteTime(300);
    setBlackTime(300);
    finishedRef.current = false;
  }, []);

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

    resetMatch();
    setActiveStake(desiredStake);
    setPhase('playing');
    setSetupNote(
      challenge
        ? 'Stake locked. The challenge board is ready.'
        : mode === 'solo'
          ? 'Solo blitz board ready. You have White.'
          : `${selectedFriend?.name || 'Your friend'} sits across the board. Use Challenges for a shareable invite room.`,
    );
  }, [challenge, mode, onLockStake, resetMatch, selectedFriend?.name, selectedFriendId, stakeInput]);

  const makeMove = (from:string, to:string) => {
    const chess = chessRef.current;
    try {
      const mv = chess.move({ from, to, promotion:'q' });
      if (mv) {
        setFen(chess.fen());
        setMoves((value) => [...value, mv.san]);
        setSelected(null);
        const ended = checkEnd();
        if (!ended && !humanOnly && chess.turn() === 'b') {
          window.setTimeout(botMove, 420);
        }
        return true;
      }
    } catch {}
    return false;
  };

  if (phase === 'setup') {
    const projectedPot = stakeInput > 0 ? stakeInput * 2 : 0;

    return (
      <GameScreen className="max-w-5xl">
        <GameHero
          accent="slate"
          eyebrow="Grandline Chess"
          title="Set your board before the first move."
          subtitle="Launch a 5+0 solo blitz match against the computer or lock a friend-backed chess table with the same premium visual language as the main app."
          onExit={onExit}
          exitLabel="Exit table"
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="gold">{challenge ? 'Challenge board' : 'Quick start'}</Badge>
            <Badge variant="default">{humanOnly ? 'Friends-enabled' : 'Solo AI ready'}</Badge>
            <Badge variant="emerald">Wallet-backed stake</Badge>
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
                      ? 'border-indigo-300/35 bg-gradient-to-br from-indigo-500/30 via-slate-500/18 to-fuchsia-500/10 shadow-[0_18px_50px_rgba(99,102,241,0.18)]'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                  )}
                >
                  <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Single</div>
                  <div className="mt-2 text-[22px] font-[720] tracking-tight">Play the computer</div>
                  <div className="mt-2 text-[13.4px] leading-6 text-slate-300">One stake, one AI opponent, and a fast 5+0 solo blitz table.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('friends')}
                  className={cn(
                    'rounded-[24px] border p-4 text-left text-white transition',
                    mode === 'friends'
                      ? 'border-indigo-300/35 bg-gradient-to-br from-slate-400/24 via-zinc-500/18 to-indigo-500/12 shadow-[0_18px_50px_rgba(15,23,42,0.28)]'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                  )}
                >
                  <div className="text-[12px] uppercase tracking-[0.2em] text-slate-400">Friends</div>
                  <div className="mt-2 text-[22px] font-[720] tracking-tight">Play with someone</div>
                  <div className="mt-2 text-[13.4px] leading-6 text-slate-300">Choose a chess friend and lock the board before the clock starts.</div>
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
                <div className="font-[650] text-white">Board type</div>
                <div className="mt-1">{humanOnly ? 'Friends board' : 'Solo board against the computer'}</div>
                <div className="mt-2 text-[12.8px] leading-5 text-slate-400">{challenge ? `Matched with ${players.black.name}.` : humanOnly ? 'Each player locks the same entry amount before the clock begins.' : 'The AI sits instantly once your stake is locked.'}</div>
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
                  <div className="mt-1">{selectedFriend ? `${selectedFriend.avatar} ${selectedFriend.name} takes Black for this board.` : 'Choose who should sit across from you.'}</div>
                  <div className="mt-2 text-[12.8px] leading-5 text-slate-400">For posted or shareable invite rooms, use the Challenges tab.</div>
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
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Clock</div>
                  <div className="mt-1 text-[21px] font-[740] text-white">5+0 blitz</div>
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
                {challenge ? 'Lock seat & start' : humanOnly ? 'Open friends board' : 'Start solo match'}
              </Button>
              <Button variant="secondary" onClick={onExit}>Back</Button>
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="font-[680] text-white">What this setup gives you</div>
            <div className="mt-3 space-y-3 text-[13.4px]">
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Solo or friends</div>
                <div className="mt-1 leading-6 text-slate-300">You can launch a quick board against the computer or switch to a friend-backed chess table first.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Stake preview</div>
                <div className="mt-1 leading-6 text-slate-300">The setup shows what each player is locking, the total pot, and the winner payout after rake.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Fast blitz clock</div>
                <div className="mt-1 leading-6 text-slate-300">Both sides start on 5 minutes and the clock begins only after the board is launched.</div>
              </div>
              <div className={gameInfoCardClass}>
                <div className="font-[650] text-white">Challenge support</div>
                <div className="mt-1 leading-6 text-slate-300">Accepted invite boards reuse this same lock-and-start flow before the first move.</div>
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
        accent="slate"
        eyebrow="Grandline Chess"
        title={humanOnly ? 'Friends board live' : 'Solo blitz live'}
        subtitle="A focused chess table with live clocks, a cleaner move pane, and visual styling that now matches the premium arena shell."
        onExit={onExit}
        exitLabel="Exit table"
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="gold">Stake {activeStake ? money(activeStake) : 'Practice'}</Badge>
          <Badge variant="default">{humanOnly ? 'Shared board' : 'Grandline AI'}</Badge>
          <Badge variant="emerald">{turn === 'w' ? `${players.white.name} to move` : `${players.black.name} to move`}</Badge>
        </div>
      </GameHero>
      <div className="grid lg:grid-cols-[minmax(340px,640px)_360px] gap-7 items-start">
        <GamePanel className="p-[18px] sm:p-6">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-200">
            <div className="flex items-center gap-2"><span className="text-xl">{players.black.avatar}</span> {players.black.name} • {players.black.rating}</div>
            <div className="font-[650] tabular-nums text-white">{Math.floor(blackTime/60)}:{String(blackTime%60).padStart(2,'0')}</div>
          </div>

          <div className="aspect-square w-full rounded-[18px] overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-[#e9e2d7]">
            <div className="grid grid-cols-8 w-full h-full">
              {board.flatMap((row,ri)=> row.map((sq, ci)=>{
                const file = 'abcdefgh'[ci];
                const rank = 8-ri;
                const square = `${file}${rank}`;
                const dark = (ri+ci)%2===1;
                const piece = sq ? PIECES[sq.color==='w' ? sq.type.toUpperCase() : sq.type] : '';
                const isSel = selected===square;
                const isTarget = legalTargets.has(square);
                const currentColor = turn;
                return (
                  <button
                    key={square}
                    type="button"
                    onClick={()=>{
                      if(selected && isTarget){ makeMove(selected, square); return; }
                      if(sq && sq.color===currentColor){ setSelected(square); } else { setSelected(null); }
                    }}
                    className={cn(
                      'relative flex items-center justify-center text-[28px] sm:text-[37px] transition',
                      dark ? 'bg-[#c8b79d] dark:bg-[#3b3329]' : 'bg-[#f1e8da] dark:bg-[#5b4d3b]',
                      isSel && 'ring-3 ring-amber-400 z-10',
                    )}
                  >
                    <span className={sq?.color==='w' ? 'text-zinc-900' : 'text-zinc-800'} style={{filter:'drop-shadow(0 1px 0 rgba(255,255,255,.35))'}}>{piece}</span>
                    {isTarget && <span className="absolute w-[14px] h-[14px] rounded-full bg-zinc-900/30 dark:bg-amber-200/40" />}
                  </button>
                );
              }))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-200">
            <div className="flex items-center gap-2"><span className="text-xl">{players.white.avatar}</span> {players.white.name} • {players.white.rating}</div>
            <div className="font-[650] tabular-nums text-white">{Math.floor(whiteTime/60)}:{String(whiteTime%60).padStart(2,'0')}</div>
          </div>
        </GamePanel>

        <div className="space-y-4">
          <GamePanel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-[670] text-white">Move list</div>
              <Pill className={gamePillClass}>{turn === 'w' ? `${players.white.name} to move` : `${players.black.name} to move`}</Pill>
            </div>
            <div className="mt-3 h-[220px] overflow-auto rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-3 font-mono text-[13.5px] text-slate-200">
              {moves.length===0 ? <span className="text-slate-500">d4 and e4 still own the center.</span> : (
                <div className="grid grid-cols-[34px_1fr_1fr] gap-x-3 gap-y-1">
                  {Array.from({length: Math.ceil(moves.length/2)}).map((_,i)=>(
                    <React.Fragment key={i}>
                      <div className="text-slate-500">{i+1}.</div>
                      <div>{moves[i*2]||''}</div>
                      <div>{moves[i*2+1]||''}</div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 text-[12.6px] text-slate-400">Click the side to move, then a highlighted square. Auto-queen stays on.</div>
          </GamePanel>
          <GamePanel className="p-5">
            <div className="font-[630] text-white">Table rules</div>
            <ul className="mt-2 space-y-1 pl-4 text-[13.4px] text-slate-300 list-disc">
              <li>{humanOnly ? 'Friends mode uses a shared board. Use Challenges for posted invites.' : 'Solo mode uses the tactical Grandline bot.'}</li>
              <li>Draw = stake refund</li>
              <li>Auto-queen promotion</li>
              <li>Clock keeps running by side to move</li>
            </ul>
          </GamePanel>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={()=>onFinish({score:moves.length, won:false, payout:activeStake>0?activeStake:0, msg:'Draw offered — accepted', stake: activeStake})}
            >
              Offer draw
            </Button>
            <Button
              variant="danger"
              onClick={()=>onFinish({score:moves.length, won:false, payout:0, msg:'Resigned', stake: activeStake})}
            >
              Resign
            </Button>
          </div>
        </div>
      </div>
    </GameScreen>
  );
}
