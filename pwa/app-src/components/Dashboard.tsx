import React from 'react';
import {
  FEATURED_TOURNAMENT,
  DAILY_MISSIONS,
  GAME_META,
  mockChallenges,
  mockMatches,
  mockOnlinePlayers,
} from '../lib/mock';
import { GAME_RULES } from '../lib/gameRules';
import { cn, money, timeAgo } from '../lib/utils';
import { Badge, Button, GlassCard } from './ui';
import type { GameId, User } from '../lib/types';
import { Bell, ChevronRight, Crown, Flame, Sparkles, Swords, Trophy } from 'lucide-react';

const GAME_GRADIENTS: Record<GameId, string> = {
  words: 'from-amber-500 via-orange-500 to-rose-500',
  scrabble: 'from-sky-500 via-indigo-500 to-violet-600',
  chess: 'from-slate-500 via-zinc-500 to-stone-700',
  ludo: 'from-emerald-500 via-lime-500 to-green-600',
  whot: 'from-cyan-500 via-teal-500 to-emerald-600',
};

type NavigateView = 'dashboard' | 'challenges' | 'leaderboard' | 'wallet' | 'profile';

export function Dashboard({
  user,
  balance,
  onPlay,
  onChallenge,
  onNavigate,
  onClaimMission,
  claimedMissionIds,
}: {
  user: User;
  balance: number;
  onPlay: (game: GameId, stake?: number)=>void;
  onChallenge: (intent?: { game?: GameId; inviteScope?: 'public' | 'private'; stake?: number; friendId?: string })=>void;
  onNavigate: (view: NavigateView) => void;
  onClaimMission: (missionId: string, reward: number, title: string) => void;
  claimedMissionIds: string[];
}) {
  const hotTables = React.useMemo(
    () => mockChallenges.slice().sort((left, right) => right.stake - left.stake).slice(0, 3),
    [],
  );

  return (
    <div className="space-y-6 pb-6 text-white">
      <div className="flex items-center justify-between px-1">
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-[0.24em] text-slate-500">Welcome back</div>
          <h1 className="mt-1 text-[30px] font-[800] tracking-[-0.04em]">{user.displayName}</h1>
          <div className="mt-1 text-[13px] text-slate-400">Your stake-ready arena for Ludo, Chess, Whot, WordForge and Scrabble.</div>
        </div>
        <button className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl">
          <Bell className="h-5 w-5 text-slate-200" />
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose-400" />
        </button>
      </div>

      <GlassCard className="overflow-hidden border-indigo-400/[0.16] bg-gradient-to-br from-indigo-600/[0.36] via-[#1b2954]/88 to-[#111827]/98 p-5">
        <div className="absolute right-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-fuchsia-500/[0.18] blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-[0.24em] text-indigo-100/80">Total balance</div>
            <div className="mt-2 text-[35px] font-[900] tracking-[-0.05em]">{money(balance)}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-indigo-100/90">
              <Badge variant="emerald">Live bankroll</Badge>
              <Badge variant="purple">{mockOnlinePlayers.length}+ players online</Badge>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-100/70">This week</div>
            <div className="mt-1 text-[18px] font-[800] text-emerald-300">+{money(62.4)}</div>
            <div className="text-[12px] text-slate-300">72% win rate</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="gold" fullWidth onClick={() => onNavigate('wallet')}>Add funds</Button>
          <Button variant="secondary" fullWidth onClick={() => onNavigate('challenges')}>Open lobby</Button>
        </div>
      </GlassCard>

      <GlassCard className="relative overflow-hidden p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-300/10 via-transparent to-fuchsia-400/8" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <Badge variant="gold">{FEATURED_TOURNAMENT.prizePool} prize pool</Badge>
            <div className="mt-3 text-[24px] font-[850] leading-tight tracking-[-0.04em]">{FEATURED_TOURNAMENT.title}</div>
            <div className="mt-2 max-w-[16rem] text-[13px] leading-5 text-slate-300">{FEATURED_TOURNAMENT.subtitle}</div>
          </div>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-white/10">
            <Trophy className="h-7 w-7 text-amber-300" />
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-[0.2em] text-slate-500">{FEATURED_TOURNAMENT.startsIn}</div>
            <div className="mt-1 text-[13px] text-slate-300">{FEATURED_TOURNAMENT.entryLabel}</div>
          </div>
          <Button variant="primary" onClick={() => onNavigate('leaderboard')}>
            View bracket
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </GlassCard>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Quick play</div>
            <div className="text-[12px] text-slate-500">Tap a game and jump straight into the right flow.</div>
          </div>
          <button onClick={() => onNavigate('challenges')} className="flex items-center text-[12px] font-[700] text-indigo-300">
            All rooms
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="hide-scrollbar flex gap-4 overflow-x-auto px-1 pb-1">
          {(Object.keys(GAME_META) as GameId[]).map((gid) => {
            const meta = GAME_META[gid];
            const rule = GAME_RULES[gid];
            const primaryAction = () => {
              if (rule.supportsSolo) {
                onPlay(gid);
                return;
              }
              onChallenge({ game: gid, inviteScope: 'public', stake: gid === 'words' ? 5 : gid === 'scrabble' ? 7 : 0 });
            };
            const secondaryAction = () => {
              if (rule.supportsSolo) {
                onPlay(gid, 5);
                return;
              }
              onChallenge({ game: gid, inviteScope: 'private', stake: gid === 'words' ? 5 : gid === 'scrabble' ? 7 : 0 });
            };
            return (
              <GlassCard key={gid} interactive className="min-w-[188px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('grid h-14 w-14 place-items-center rounded-[20px] bg-gradient-to-br text-2xl shadow-[0_12px_30px_rgba(0,0,0,0.25)]', GAME_GRADIENTS[gid])}>
                    <span>{meta.emoji}</span>
                  </div>
                  <Badge variant={gid === 'chess' ? 'gold' : gid === 'words' ? 'emerald' : 'purple'}>{meta.players}</Badge>
                </div>
                <div className="mt-4 text-[17px] font-[800] tracking-[-0.03em]">{meta.name}</div>
                <div className="mt-1 min-h-[40px] text-[12px] leading-5 text-slate-400">{meta.tagline}</div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" fullWidth onClick={primaryAction}>{rule.quickPlayLabel}</Button>
                  <Button variant="secondary" size="sm" fullWidth onClick={secondaryAction}>{rule.wagerLabel}</Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Daily missions</div>
            <div className="text-[12px] text-slate-500">Claim quick rewards as you keep the streak alive.</div>
          </div>
          <Badge variant="emerald">
            <Sparkles className="h-3.5 w-3.5" />
            Bonus loop
          </Badge>
        </div>

        {DAILY_MISSIONS.map((mission) => {
          const complete = mission.progress >= mission.target;
          const claimed = claimedMissionIds.includes(mission.id);
          const progressPct = Math.min(100, (mission.progress / mission.target) * 100);
          return (
            <GlassCard key={mission.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-lg', GAME_GRADIENTS[mission.game])}>
                      {GAME_META[mission.game].emoji}
                    </span>
                    <div>
                      <div className="text-[14px] font-[750]">{mission.title}</div>
                      <div className="text-[12px] text-slate-400">{mission.detail}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className={cn('h-full rounded-full bg-gradient-to-r', GAME_GRADIENTS[mission.game])} style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="mt-2 text-[12px] text-slate-500">{mission.progress}/{mission.target} complete</div>
                </div>
                <Button
                  size="sm"
                  variant={claimed ? 'secondary' : complete ? 'gold' : 'outline'}
                  disabled={claimed || !complete}
                  onClick={() => onClaimMission(mission.id, mission.reward, mission.title)}
                >
                  {claimed ? 'Claimed' : complete ? `Claim $${mission.reward}` : 'Locked'}
                </Button>
              </div>
            </GlassCard>
          );
        })}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Last 20', value: '14-6', tone: 'text-white', icon: Flame },
          { label: 'Hot streak', value: '5 wins', tone: 'text-amber-300', icon: Sparkles },
          { label: 'Global', value: '#482', tone: 'text-indigo-300', icon: Crown },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4 text-center">
            <stat.icon className={cn('mx-auto h-4 w-4', stat.tone)} />
            <div className={cn('mt-2 text-[17px] font-[800] tracking-[-0.03em]', stat.tone)}>{stat.value}</div>
            <div className="text-[11px] text-slate-500">{stat.label}</div>
          </GlassCard>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Hot tables</div>
            <div className="text-[12px] text-slate-500">High-energy rooms and challenge codes moving right now.</div>
          </div>
          <button onClick={() => onNavigate('challenges')} className="flex items-center text-[12px] font-[700] text-indigo-300">
            Open lobby
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {hotTables.map((table) => (
            <GlassCard key={table.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-xl', GAME_GRADIENTS[table.game])}>
                  <span>{GAME_META[table.game].emoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[14px] font-[780]">{table.creator.name}</div>
                    <Badge variant="default">{GAME_META[table.game].short}</Badge>
                  </div>
                  <div className="text-[12px] text-slate-400">
                    Stake {money(table.stake)} • {table.inviteScope === 'private' ? 'Invite room' : 'Public table'} • {timeAgo(table.createdAt)}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onNavigate('challenges')}>
                  <Swords className="h-3.5 w-3.5" />
                  View
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent results</div>
            <div className="text-[12px] text-slate-500">Momentum from the last few settled matches.</div>
          </div>
          <button onClick={() => onNavigate('profile')} className="flex items-center text-[12px] font-[700] text-indigo-300">
            Match log
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {mockMatches.slice(0, 3).map((match) => (
            <GlassCard key={match.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.08] text-lg">{match.opponent.avatar}</div>
                  <div>
                    <div className="text-[14px] font-[760]">{match.opponent.name}</div>
                    <div className="text-[12px] text-slate-400">{GAME_META[match.game].name} • {match.score}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-[14px] font-[800]', match.result === 'win' ? 'text-emerald-300' : match.result === 'draw' ? 'text-amber-200' : 'text-slate-200')}>
                    {match.result.toUpperCase()}
                  </div>
                  <div className="text-[12px] text-slate-500">{money(match.payout)}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LeaderboardView() {
  const rankedPlayers = [...mockOnlinePlayers].sort((left, right) => right.rating - left.rating);
  const podium = rankedPlayers.slice(0, 3);
  const contenders = rankedPlayers.slice(3);

  return (
    <div className="space-y-6 pb-6 text-white">
      <div className="px-1 text-center">
        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-500">Season ladder</div>
        <h2 className="mt-1 text-[30px] font-[850] tracking-[-0.04em]">Global ranks</h2>
        <div className="mt-1 text-[13px] text-slate-400">Top players across live-money tables this week.</div>
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
                  <div className="text-[11px] text-slate-400">{player.rating} Elo</div>
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
              <div className="w-6 text-center text-[13px] font-[800] text-slate-500">{index + 4}</div>
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
    </div>
  );
}
