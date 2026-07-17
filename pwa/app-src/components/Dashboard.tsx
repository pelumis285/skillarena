import React from 'react';
import { GAME_META, mockMatches, mockOnlinePlayers, mockTournaments } from '../lib/mock';
import { GAME_RULES } from '../lib/gameRules';
import { cn, money, timeAgo } from '../lib/utils';
import { Badge, Button, Field, GlassCard, Modal } from './ui';
import type { Challenge, GameId, Tournament, User } from '../lib/types';
import { betaApi } from '../lib/api';
import { ChevronRight, Sparkles, Trophy } from 'lucide-react';

const GAME_GRADIENTS: Record<GameId, string> = {
  words: 'from-[var(--purple)] to-[#8e69f0]',
  scrabble: 'from-[#915cff] to-[#b677ff]',
  chess: 'from-[var(--blue)] to-[#57a4ef]',
  ludo: 'from-[var(--orange)] to-[#ffa54e]',
  whot: 'from-[var(--teal)] to-[#35d2b4]',
};

type NavigateView = 'dashboard' | 'challenges' | 'leaderboard' | 'wallet' | 'profile';

export function Dashboard({
  user,
  balance,
  onPlay,
  onChallenge,
  onNavigate,
  claimedMissionIds: _claimedMissionIds,
}: {
  user: User;
  balance: number;
  onPlay: (game: GameId, stake?: number)=>void;
  onChallenge: (intent?: { game?: GameId; inviteScope?: 'public' | 'private'; stake?: number; friendId?: string })=>void;
  onNavigate: (view: NavigateView) => void;
  onClaimMission: (missionId: string, reward: number, title: string) => void;
  claimedMissionIds: string[];
}) {
  const firstName = user.displayName.split(' ')[0] || user.displayName;
  const gameCards = [
    { id: 'words' as GameId, name: 'WordForge', detail: 'Build high-scoring words • 8 min', icon: '🔤' },
    { id: 'chess' as GameId, name: 'Grandline Chess', detail: '10-minute rapid • Skill matched', icon: '♘' },
    { id: 'ludo' as GameId, name: 'Ludo Rush', detail: '2–4 players • Fast rounds', icon: '🎲' },
    { id: 'whot' as GameId, name: 'Whot Arena', detail: 'Classic call play • Table stakes', icon: '🃏' },
    { id: 'scrabble' as GameId, name: 'Scrabble Social', detail: 'Board duel • Live rooms', icon: '🔠' },
  ];

  const quickLaunch = (gameId: GameId) => {
    const rule = GAME_RULES[gameId];
    if (gameId === 'words' || gameId === 'scrabble') {
      onChallenge({ game: gameId, inviteScope: 'public', stake: gameId === 'words' ? 10 : 7 });
      return;
    }
    if (rule.supportsSolo) {
      onPlay(gameId);
      return;
    }
    onChallenge({ game: gameId, inviteScope: 'public', stake: 5 });
  };

  return (
    <div className="space-y-8 pb-8 text-white">
      <div>
        <h1 className="skill-screen-title">Good evening, {firstName}</h1>
        <p className="mt-3 skill-screen-subtitle">Find a fair match or continue where you left off.</p>
      </div>

      <GlassCard className="p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
          <div>
            <div className="text-[15px] font-[700] text-[var(--muted)]">Available balance</div>
            <div className="mt-4 text-[2.8rem] font-[800] tracking-[-0.08em] sm:text-[3.4rem]">{money(balance)}</div>
          </div>
          <Button size="md" fullWidth onClick={() => onNavigate('wallet')} className="mt-1 sm:mt-2 sm:min-w-[11rem] sm:w-auto">
            Deposit
          </Button>
        </div>
      </GlassCard>

      <section>
        <h2 className="mb-5 text-[2.15rem] font-[800] tracking-[-0.06em] text-white">Choose a game</h2>
        <div className="space-y-5">
          {gameCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => quickLaunch(card.id)}
              className={cn('w-full rounded-[2rem] bg-gradient-to-r px-5 py-6 text-left shadow-[0_20px_48px_rgba(0,0,0,0.16)] sm:rounded-[2.2rem] sm:px-8 sm:py-9', GAME_GRADIENTS[card.id])}
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="text-[2rem] sm:text-[2.35rem]">{card.icon}</div>
                <div>
                  <div className="text-[1.6rem] font-[800] tracking-[-0.05em] text-white sm:text-[2rem]">{card.name}</div>
                  <div className="mt-3 text-[14px] font-[500] text-[#111827] sm:mt-4 sm:text-[15px]">{card.detail}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        <Button size="lg" fullWidth onClick={() => onNavigate('challenges')}>
          Quick match
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={() => onNavigate('challenges')}>
          Open challenges
        </Button>
      </div>

      <GlassCard className="p-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent results</div>
            <div className="mt-2 text-[14px] text-[var(--muted)]">Clear scorelines and payout history from your latest sessions.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('leaderboard')}>
            Tournament hub
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {mockMatches.slice(0, 3).map((match) => (
            <div key={match.id} className="rounded-[1.7rem] bg-[var(--surface-2)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-[700]">{GAME_META[match.game].name} vs {match.opponent.name}</div>
                  <div className="mt-2 text-[14px] text-[var(--muted)]">{match.result.toUpperCase()} • {match.score} • {timeAgo(match.at)}</div>
                </div>
                <div className={cn('text-[15px] font-[800]', match.result === 'win' ? 'text-[#39d98a]' : match.result === 'draw' ? 'text-[#c5cbd9]' : 'text-[#ff9d47]')}>
                  {money(match.payout)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="rounded-[2rem] bg-[var(--surface)] px-5 py-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[17px] font-[800]">Players online</div>
            <div className="mt-2 text-[14px] text-[var(--muted)]">Jump into a room with verified opponents.</div>
          </div>
          <Badge variant="emerald">
            <Sparkles className="h-3.5 w-3.5" />
            {mockOnlinePlayers.length} live
          </Badge>
        </div>
      </div>
    </div>
  );
}

const TOURNAMENT_SIZES: Record<GameId, number[]> = {
  ludo: [4, 8, 16],
  chess: [4, 8, 16, 32],
  whot: [4, 8, 16, 32],
  scrabble: [4, 8, 16, 32],
  words: [4, 8, 16, 32],
};

export function LeaderboardView({
  user,
  toast,
  onOpenChallenge,
  onWatchChallenge,
}: {
  user: User;
  toast: (message: string) => void;
  onOpenChallenge: (challenge: Challenge) => void;
  onWatchChallenge: (challenge: Challenge) => void;
}) {
  const rankedPlayers = [...mockOnlinePlayers].sort((left, right) => right.rating - left.rating);
  const podium = rankedPlayers.slice(0, 3);
  const contenders = rankedPlayers.slice(3);
  const [tournaments, setTournaments] = React.useState<Tournament[]>(() => betaApi.isConfigured ? [] : mockTournaments);
  const [loading, setLoading] = React.useState(betaApi.isConfigured);
  const [selectedTournamentId, setSelectedTournamentId] = React.useState<string | null>(mockTournaments[0]?.id ?? null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createTitle, setCreateTitle] = React.useState('Weekend Crown Run');
  const [createGame, setCreateGame] = React.useState<GameId>('ludo');
  const [createStake, setCreateStake] = React.useState(5);
  const [createSize, setCreateSize] = React.useState(8);
  const [createSpectators, setCreateSpectators] = React.useState(true);

  const refreshTournaments = React.useCallback(async () => {
    if (!betaApi.isConfigured) {
      setTournaments(mockTournaments);
      setSelectedTournamentId((current) => current ?? mockTournaments[0]?.id ?? null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await betaApi.listTournaments(user.id);
      setTournaments(next);
      setSelectedTournamentId((current) => current ?? next[0]?.id ?? null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load tournaments.');
      setTournaments(mockTournaments);
      setSelectedTournamentId((current) => current ?? mockTournaments[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [toast, user.id]);

  React.useEffect(() => {
    refreshTournaments();
  }, [refreshTournaments]);

  React.useEffect(() => {
    if (!TOURNAMENT_SIZES[createGame].includes(createSize)) {
      setCreateSize(TOURNAMENT_SIZES[createGame][0]);
    }
  }, [createGame, createSize]);

  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId) ?? tournaments[0] ?? null;

  const createTournament = async () => {
    try {
      const created = await betaApi.createTournament({
        title: createTitle,
        game: createGame,
        stake: Math.max(0, Number(createStake) || 0),
        maxPlayers: createSize,
        allowSpectators: createSpectators,
        creator: {
          id: user.id,
          name: user.displayName,
          avatar: user.avatar,
          rating: user.rating,
        },
      });
      setTournaments((current) => [created, ...current]);
      setSelectedTournamentId(created.id);
      setShowCreate(false);
      toast(`${created.title} is live. Fill the bracket to seed round one.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the tournament.');
    }
  };

  const joinTournament = async (tournamentId: string) => {
    try {
      const updated = await betaApi.joinTournament(tournamentId, user);
      setTournaments((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setSelectedTournamentId(updated.id);
      toast(updated.status === 'live' ? 'Bracket filled. Round one tables are ready.' : 'Tournament seat secured.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not join this tournament.');
    }
  };

  const reportMyWin = async (tournamentId: string, matchId: string) => {
    try {
      const updated = await betaApi.reportTournamentWinner(tournamentId, matchId, user.id, user.id);
      setTournaments((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setSelectedTournamentId(updated.id);
      toast('Winner reported. The bracket has been updated.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not report this result.');
    }
  };

  return (
    <div className="space-y-6 pb-6 text-white">
      <div className="px-1 text-center">
        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-400">Tournament hub</div>
        <h2 className="mt-1 text-[30px] font-[850] tracking-[-0.04em]">Brackets and global ranks</h2>
        <div className="mt-1 text-[13px] text-slate-300">Create all-game tournaments, join seeded brackets, and follow the live ladder in one place.</div>
      </div>

      <GlassCard className="overflow-hidden border-amber-300/18 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(15,23,42,0.94))] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="gold">Cross-game brackets</Badge>
            <div className="mt-3 text-[25px] font-[850] tracking-[-0.04em] text-white">Create a readable, watchable tournament room</div>
            <div className="mt-2 max-w-[18rem] text-[13.2px] leading-6 text-slate-200">
              Ludo runs four-player group tables. Chess, Whot, WordForge, and Scrabble run bracket duels. Spectators can chat and support live rooms as rounds progress.
            </div>
          </div>
          <Button variant="gold" onClick={() => setShowCreate(true)}>Create tournament</Button>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="text-[18px] font-[800] tracking-[-0.03em]">Live tournaments</div>
              <div className="text-[12px] text-slate-300">Readable cards for open, live, and completed brackets.</div>
            </div>
            <Button variant="secondary" size="sm" onClick={refreshTournaments}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
          </div>

          {(tournaments.length ? tournaments : mockTournaments).map((tournament) => {
            const joined = tournament.participants.some((participant) => participant.id === user.id);
            const statusTone = tournament.status === 'completed'
              ? 'border-emerald-300/24 bg-emerald-400/[0.12] text-emerald-100'
              : tournament.status === 'live'
                ? 'border-amber-300/24 bg-amber-300/[0.12] text-amber-100'
                : 'border-sky-300/24 bg-sky-400/[0.12] text-sky-100';

            return (
              <GlassCard
                key={tournament.id}
                interactive
                className={cn(
                  'cursor-pointer p-4',
                  selectedTournament?.id === tournament.id ? 'border-indigo-300/35 bg-white/[0.09]' : 'border-white/10 bg-white/[0.05]',
                )}
                onClick={() => setSelectedTournamentId(tournament.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">{GAME_META[tournament.game].name}</div>
                    <div className="mt-1 text-[18px] font-[780] tracking-[-0.03em] text-white">{tournament.title}</div>
                    <div className="mt-2 text-[12.8px] text-slate-300">
                      {tournament.participants.length}/{tournament.maxPlayers} players • {money(tournament.stake)} stake • {money(tournament.prizePool)} prize
                    </div>
                  </div>
                  <Badge className={statusTone}>{tournament.status === 'open' ? 'Open' : tournament.status === 'live' ? 'Live' : 'Complete'}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[12.2px] text-slate-300">
                    {tournament.game === 'ludo'
                      ? `${tournament.seatsPerMatch}-seat tables in each group`
                      : 'Head-to-head bracket rounds'}
                  </div>
                  {joined ? (
                    <Button size="sm" variant="secondary">Joined</Button>
                  ) : (
                    <Button size="sm" onClick={() => joinTournament(tournament.id)} disabled={tournament.status !== 'open'}>
                      {tournament.status === 'open' ? 'Join bracket' : 'Bracket closed'}
                    </Button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>

        <GlassCard className="p-5">
          {!selectedTournament ? (
            <div className="text-[13px] text-slate-300">Pick a tournament to inspect the bracket.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">{GAME_META[selectedTournament.game].short} bracket</div>
                  <div className="mt-1 text-[24px] font-[820] tracking-[-0.04em] text-white">{selectedTournament.title}</div>
                  <div className="mt-2 text-[13px] leading-6 text-slate-200">
                    {selectedTournament.participants.length}/{selectedTournament.maxPlayers} joined • {selectedTournament.allowSpectators ? 'Spectators allowed' : 'Players only'} • {money(selectedTournament.prizePool)} projected prize pool
                  </div>
                </div>
                <Badge variant="gold">Round {selectedTournament.currentRound + 1}</Badge>
              </div>

              {selectedTournament.rounds.length === 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-5 text-[13px] leading-6 text-slate-300">
                  This bracket seeds itself once all seats are filled. Players can already join now, and the first tables will appear here as soon as the bracket locks.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedTournament.rounds.map((round) => (
                    <div key={round.index} className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[17px] font-[760] tracking-[-0.03em] text-white">{round.label}</div>
                        <div className="text-[12px] text-slate-300">{round.matches.length} table{round.matches.length === 1 ? '' : 's'}</div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {round.matches.map((match) => {
                          const isPlayer = match.participants.some((participant) => participant.id === user.id);
                          const winner = match.participants.find((participant) => participant.id === match.winnerUserId);
                          const canWatch = !!match.challenge?.allowSpectators && !!match.challenge && match.challenge.game === 'ludo';
                          return (
                            <div key={match.id} className="rounded-[20px] border border-white/10 bg-[#111a30]/72 px-4 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Table {match.position + 1}</div>
                                  <div className="mt-1 text-[13.5px] text-slate-100">
                                    {match.participants.length
                                      ? match.participants.map((participant) => `${participant.avatar} ${participant.name}`).join(' vs ')
                                      : 'Waiting for winners to advance'}
                                  </div>
                                  <div className="mt-2 text-[12px] text-slate-300">
                                    {winner ? `Winner: ${winner.name}` : match.status === 'waiting' ? 'Next round seat' : match.status === 'in_progress' ? 'Live now' : match.status}
                                  </div>
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                  {match.challenge && isPlayer && (
                                    <Button size="sm" onClick={() => onOpenChallenge(match.challenge!)}>Open match</Button>
                                  )}
                                  {match.challenge && canWatch && !isPlayer && (
                                    <Button size="sm" variant="secondary" onClick={() => onWatchChallenge(match.challenge!)}>Watch</Button>
                                  )}
                                  {match.challenge && isPlayer && !winner && (
                                    <Button size="sm" variant="secondary" onClick={() => reportMyWin(selectedTournament.id, match.id)}>
                                      Report my win
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="px-1 text-center">
        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-400">Season ladder</div>
        <h3 className="mt-1 text-[28px] font-[850] tracking-[-0.04em] text-white">Global ranks</h3>
        <div className="mt-1 text-[13px] text-slate-300">Top players across live-money tables this week.</div>
      </div>

      <GlassCard className="overflow-hidden p-5">
        <div className="grid grid-cols-3 items-end gap-3">
          {[podium[1], podium[0], podium[2]].map((player, index) => {
            if (!player) return <div key={index} />;
            const position = index === 1 ? 1 : index === 0 ? 2 : 3;
            const height = position === 1 ? 'h-32' : position === 2 ? 'h-24' : 'h-20';
            const accent = position === 1
              ? 'from-amber-400/30 to-amber-300/8 border-amber-300/40 text-amber-200'
              : position === 2
                ? 'from-slate-300/25 to-slate-300/6 border-slate-300/30 text-slate-200'
                : 'from-orange-400/20 to-orange-300/[0.06] border-orange-300/[0.28] text-orange-200';
            return (
              <div key={player.id} className="flex flex-col items-center">
                <div className={cn(
                  'mb-3 grid place-items-center rounded-full border-2 bg-white/[0.08] text-2xl shadow-[0_12px_30px_rgba(0,0,0,0.25)]',
                  position === 1 ? 'h-[72px] w-[72px]' : 'h-14 w-14',
                  position === 1 ? 'border-amber-300' : position === 2 ? 'border-slate-300' : 'border-orange-300',
                )}>
                  <span>{player.avatar}</span>
                </div>
                <div className={cn('w-full rounded-t-[24px] border bg-gradient-to-t px-3 pt-3 text-center', accent, height)}>
                  <div className="text-[24px] font-[900]">{position}</div>
                  <div className="mt-2 truncate text-[13px] font-[700] text-white">{player.name}</div>
                  <div className="text-[11px] text-slate-300">{player.rating} Elo</div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div className="space-y-3">
        {contenders.map((player, index) => (
          <GlassCard key={player.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-6 text-center text-[13px] font-[800] text-slate-400">{index + 4}</div>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-lg">{player.avatar}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-[760]">{player.name}</div>
                <div className="text-[12px] text-slate-400">{GAME_META[player.game].short} • {player.wlr} win rate</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-[800] text-emerald-300">{player.rating}</div>
                <Badge variant="purple">{player.stakePref}</Badge>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create tournament" maxWidth="max-w-xl">
        <div className="space-y-4">
          <Field label="Tournament title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[12.8px]">
              <div className="mb-3 font-[700] text-[var(--muted)]">Game</div>
              <select
                value={createGame}
                onChange={(event) => setCreateGame(event.target.value as GameId)}
                className="w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-4 py-4 text-[15px] text-white outline-none"
              >
                {(Object.keys(GAME_META) as GameId[]).map((game) => (
                  <option key={game} value={game}>{GAME_META[game].name}</option>
                ))}
              </select>
            </label>
            <Field label="Stake per player" type="number" value={createStake} onChange={(event) => setCreateStake(Math.max(0, parseFloat(event.target.value) || 0))} />
            <label className="block text-[12.8px]">
              <div className="mb-3 font-[700] text-[var(--muted)]">Bracket size</div>
              <select
                value={createSize}
                onChange={(event) => setCreateSize(Number(event.target.value))}
                className="w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-4 py-4 text-[15px] text-white outline-none"
              >
                {TOURNAMENT_SIZES[createGame].map((size) => (
                  <option key={size} value={size}>{size} players</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => setCreateSpectators((current) => !current)}
            className={cn(
              'w-full rounded-[1.5rem] border px-4 py-4 text-left text-[14px] transition',
              createSpectators
                ? 'border-emerald-300/40 bg-emerald-400/[0.12] text-emerald-100'
                : 'border-white/10 bg-[var(--surface)] text-slate-100',
            )}
          >
            {createSpectators ? 'Spectators can watch, chat, and support live rooms.' : 'This tournament is players-only.'}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1 justify-center" onClick={createTournament}>Post tournament</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
