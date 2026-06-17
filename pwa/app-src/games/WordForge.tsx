import React from 'react';
import { Badge, Button, Pill } from '../components/ui';
import { GameHero, GamePanel, GameScreen, gamePillClass } from '../components/GameShell';
import { generateWordRack } from '../lib/utils';
import { canSpellFromTiles, localWordValid, wordScore } from '../lib/wordBank';
import type { Challenge, User } from '../lib/types';

type Props = {
  stake: number;
  challenge?: Challenge;
  user: User;
  onFinish: (result:{score:number, won:boolean, payout:number, msg?:string})=>void;
  onExit: ()=>void;
};

type RoundState = {
  rack: string[];
  found: { w: string; pts: number }[];
};

const ROUND_SECONDS = 60;

function playerList(challenge: Challenge | undefined, user: User) {
  if (!challenge) {
    return [
      { id: user.id, name: user.displayName, avatar: user.avatar, rating: user.rating },
      { id: 'friend-seat', name: 'Friend', avatar: '🤝', rating: 1600 },
    ];
  }

  if (challenge.creator.id === user.id) {
    const firstInvite = challenge.invitedUsers?.[0];
    return [
      { id: challenge.creator.id, name: challenge.creator.name, avatar: challenge.creator.avatar, rating: challenge.creator.rating },
      { id: challenge.invitedUserId || firstInvite?.id || 'friend-seat', name: challenge.invitedUserName || firstInvite?.name || 'Friend', avatar: challenge.participants?.find((participant) => participant.id !== user.id)?.avatar || firstInvite?.avatar || '🤝', rating: challenge.participants?.find((participant) => participant.id !== user.id)?.rating || firstInvite?.rating || 1600 },
    ];
  }

  return [
    { id: user.id, name: user.displayName, avatar: user.avatar, rating: user.rating },
    { id: challenge.creator.id, name: challenge.creator.name, avatar: challenge.creator.avatar, rating: challenge.creator.rating },
  ];
}

export function WordForge({ stake, challenge, user, onFinish, onExit }: Props) {
  const players = React.useMemo(() => playerList(challenge, user), [challenge, user]);
  const [rounds, setRounds] = React.useState<RoundState[]>(() => players.map(() => ({
    rack: generateWordRack(),
    found: [],
  })));
  const [turnIndex, setTurnIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<'ready' | 'playing' | 'handoff'>('ready');
  const [seconds, setSeconds] = React.useState(ROUND_SECONDS);
  const [input, setInput] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const currentPlayer = players[turnIndex];
  const currentRound = rounds[turnIndex];
  const currentScore = currentRound?.found.reduce((sum, word) => sum + word.pts, 0) || 0;

  React.useEffect(() => {
    if (phase !== 'playing') return;
    inputRef.current?.focus();
  }, [phase, turnIndex]);

  React.useEffect(() => {
    if (phase !== 'playing' || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, seconds]);

  React.useEffect(() => {
    if (phase !== 'playing' || seconds > 0) return;
    if (turnIndex === players.length - 1) {
      const scores = rounds.map((round) => round.found.reduce((sum, word) => sum + word.pts, 0));
      const playerScore = scores[0] || 0;
      const opponentScore = scores[1] || 0;
      const won = playerScore > opponentScore;
      const draw = playerScore === opponentScore;
      const pot = stake > 0 ? stake * 2 * 0.93 : 0;
      onFinish({
        score: playerScore,
        won,
        payout: draw ? stake : (won ? pot : 0),
        msg: draw ? 'WordForge finished level on points.' : `${players[0].name} ${won ? 'outscored' : 'fell short of'} ${players[1].name}.`,
      });
      return;
    }

    setPhase('handoff');
    setInput('');
    setMsg(`${currentPlayer.name} locked in ${currentScore} points.`);
  }, [currentPlayer.name, currentScore, onFinish, phase, players, rounds, seconds, stake, turnIndex]);

  const submit = async () => {
    const word = input.trim().toUpperCase();
    setInput('');

    if (word.length < 3) {
      setMsg('Minimum 3 letters.');
      return;
    }
    if (currentRound.found.some((entry) => entry.w === word)) {
      setMsg('Already used.');
      return;
    }
    if (!canSpellFromTiles(word, currentRound.rack)) {
      setMsg('Use only the letters shown.');
      return;
    }
    if (!localWordValid(word)) {
      setMsg('Not in the local word list.');
      return;
    }

    const pts = wordScore(word);
    setRounds((existing) => existing.map((round, index) => index === turnIndex ? { ...round, found: [{ w: word, pts }, ...round.found] } : round));
    setMsg(`+${pts} • Nice find.`);
  };

  if (!challenge) {
    return (
      <GameScreen className="max-w-3xl">
        <GamePanel className="p-6 sm:p-7">
          <Badge variant="gold">WordForge</Badge>
          <h2 className="mt-4 text-[32px] tracking-tight text-white" style={{ fontFamily: 'Fraunces, serif', fontWeight: 620 }}>
            Friend room required.
          </h2>
          <div className="mt-3 text-[14px] leading-6 text-slate-300">
            WordForge now runs as a private friend duel. Open it from Challenges, post a room, and reveal each rack turn by turn.
          </div>
          <div className="mt-6 flex gap-2">
            <Button onClick={onExit}>Back to lobby</Button>
          </div>
        </GamePanel>
      </GameScreen>
    );
  }

  return (
    <GameScreen className="max-w-5xl">
      <GameHero
        accent="amber"
        eyebrow="WordForge"
        title="Private rack duel"
        subtitle="Each player gets a hidden letter rack and 60 seconds to build words. The in-game flow now matches the premium shell used across the rest of the app."
        onExit={onExit}
        exitLabel="Leave table"
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="gold">Stake {stake ? `$${stake.toFixed(2)}` : 'Practice'}</Badge>
          <Badge variant="emerald">2-player friend room</Badge>
          <Badge variant="default">
            {phase === 'playing' ? `${currentPlayer.avatar} ${currentPlayer.name} on the clock` : `${currentPlayer.avatar} ${currentPlayer.name} up next`}
          </Badge>
        </div>
      </GameHero>

      {(phase === 'ready' || phase === 'handoff') && (
        <GamePanel className="border-amber-300/15 bg-[#0b1223]/94 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">{phase === 'ready' ? 'Start round' : 'Pass device'}</div>
              <div className="mt-2 text-[28px] tracking-tight text-white" style={{ fontFamily: 'Fraunces, serif', fontWeight: 620 }}>
                {phase === 'ready' ? `${currentPlayer.name} to open.` : `${players[turnIndex + 1]?.name || 'Next player'} is up next.`}
              </div>
              <div className="mt-2 text-[13.5px] leading-6 text-slate-300">
                {phase === 'ready'
                  ? 'Each player gets 60 seconds with their own rack. Highest score wins the table.'
                  : `${currentPlayer.name} finished with ${currentScore} points. Hand the phone over before revealing the next rack.`}
              </div>
            </div>
            <Button onClick={() => {
              if (phase === 'handoff') setTurnIndex((value) => value + 1);
              setPhase('playing');
              setSeconds(ROUND_SECONDS);
              setMsg('');
            }}>
              {phase === 'ready' ? 'Reveal rack' : 'Reveal next rack'}
            </Button>
          </div>
        </GamePanel>
      )}

      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5">
        <GamePanel className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-[15px] text-slate-300">{currentPlayer.avatar} {currentPlayer.name}'s rack</div>
            <div className="text-[26px] font-[730] tracking-tight tabular-nums text-white">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</div>
          </div>
          <div className="mt-5 flex gap-2 flex-wrap">
            {currentRound.rack.map((letter, index) => (
              <div
                key={`${letter}-${index}`}
                className="grid h-[68px] w-[56px] place-items-center rounded-[18px] border border-amber-200/60 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200 text-[26px] font-[750] text-[#352010] shadow-[0_10px_24px_rgba(251,191,36,0.14)]"
              >
                {letter}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              disabled={phase !== 'playing'}
              onChange={(event) => setInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
              placeholder="Type a word…"
              className="flex-1 rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-4 text-[18px] tracking-wider text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 disabled:opacity-50"
            />
            <Button onClick={submit} disabled={phase !== 'playing'} className="px-6">Play</Button>
          </div>
          <div className="mt-2 h-5 text-[13.4px] text-slate-400">{msg}</div>

          <div className="mt-5">
            <div className="mb-2 text-[12.8px] text-slate-400">Words found</div>
            <div className="flex flex-wrap gap-2 min-h-[44px]">
              {currentRound.found.length === 0 && <span className="text-sm text-slate-500">None yet</span>}
              {currentRound.found.map((foundWord) => (
                <span key={foundWord.w} className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[13.3px] text-slate-100">
                  {foundWord.w} <b className="ml-1 text-amber-200">{foundWord.pts}</b>
                </span>
              ))}
            </div>
          </div>
        </GamePanel>

        <div className="space-y-4">
          <GamePanel className="p-5">
            <div className="mb-3 font-[680] text-white">Live scoreboard</div>
            <div className="space-y-3">
              {players.map((player, index) => {
                const score = rounds[index]?.found.reduce((sum, word) => sum + word.pts, 0) || 0;
                return (
                  <div key={player.id} className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-slate-100">{player.avatar} {player.name}</div>
                      <Pill className={gamePillClass}>{score} pts</Pill>
                    </div>
                    <div className="mt-1 text-[12.6px] text-slate-400">{rounds[index]?.found.length || 0} valid words</div>
                  </div>
                );
              })}
            </div>
          </GamePanel>

          <GamePanel className="p-5">
            <div className="font-[620] text-white">Match flow</div>
            <div className="mt-2 text-[13.2px] leading-6 text-slate-300">
              Each player gets a private rack and 60 seconds. No computer score is used here anymore.
            </div>
          </GamePanel>
        </div>
      </div>
    </GameScreen>
  );
}
