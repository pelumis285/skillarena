import React from 'react';
import { ACHIEVEMENT_HIGHLIGHTS, mockMatches } from '../lib/mock';
import type { User } from '../lib/types';
import { money } from '../lib/utils';
import { Badge, Button, GlassCard } from './ui';
import { LogOut, Medal, Share2, ShieldCheck, Zap } from 'lucide-react';

const ACHIEVEMENT_ACCENTS: Record<string, string> = {
  amber: 'border-amber-300/[0.22] bg-amber-300/10',
  indigo: 'border-indigo-300/[0.22] bg-indigo-300/10',
  emerald: 'border-emerald-300/[0.22] bg-emerald-300/10',
  rose: 'border-rose-300/[0.22] bg-rose-300/10',
};

export function ProfileView({ user, onLogout }:{ user: User, onLogout:()=>void }) {
  return (
    <div className="space-y-6 pb-6 text-white">
      <GlassCard className="overflow-hidden p-5">
        <div className="absolute right-[-2rem] top-[-1rem] h-24 w-24 rounded-full bg-indigo-400/[0.14] blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <div className="rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-[3px] shadow-[0_20px_40px_rgba(99,102,241,0.3)]">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-[#09101d] text-[44px]">{user.avatar}</div>
          </div>
          <div className="mt-4 text-[29px] font-[850] tracking-[-0.04em]">{user.displayName}</div>
          <div className="mt-1 text-[13px] text-slate-400">@{user.username} • Joined {new Date(user.joinedAt).getFullYear()}</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="purple">
              <Medal className="h-3.5 w-3.5" />
              {user.tier}
            </Badge>
            <Badge variant="emerald">
              <ShieldCheck className="h-3.5 w-3.5" />
              {user.rating} Elo
            </Badge>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Matches', value: '1,432', tone: 'text-white' },
          { label: 'Win rate', value: '68%', tone: 'text-emerald-300' },
          { label: 'Streak', value: '5', tone: 'text-amber-300', icon: Zap },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4 text-center">
            {stat.icon && <stat.icon className={stat.tone + ' mx-auto h-4 w-4'} />}
            <div className={stat.icon ? stat.tone + ' mt-2 text-[21px] font-[850] tracking-[-0.04em]' : stat.tone + ' text-[21px] font-[850] tracking-[-0.04em]'}>{stat.value}</div>
            <div className="text-[11px] text-slate-500">{stat.label}</div>
          </GlassCard>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Achievements</div>
            <div className="text-[12px] text-slate-500">Milestones earned across every skill table.</div>
          </div>
          <Badge variant="gold">{ACHIEVEMENT_HIGHLIGHTS.length} badges</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENT_HIGHLIGHTS.map((achievement) => (
            <GlassCard key={achievement.id} className={`p-4 ${ACHIEVEMENT_ACCENTS[achievement.accent] ?? 'border-white/10 bg-white/[0.06]'}`}>
              <div className="text-[28px]">{achievement.emoji}</div>
              <div className="mt-2 text-[15px] font-[760]">{achievement.title}</div>
              <div className="mt-1 text-[12px] leading-5 text-slate-400">{achievement.detail}</div>
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent match log</div>
            <div className="text-[12px] text-slate-500">Settled tables and payouts from your latest sessions.</div>
          </div>
        </div>

        {mockMatches.slice(0, 4).map((match) => (
          <GlassCard key={match.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.08] text-lg">{match.opponent.avatar}</div>
                <div>
                  <div className="text-[14px] font-[760]">{match.opponent.name}</div>
                  <div className="text-[12px] text-slate-400">{match.game} • {match.score}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={match.result === 'win' ? 'text-[14px] font-[820] text-emerald-300' : match.result === 'draw' ? 'text-[14px] font-[820] text-amber-200' : 'text-[14px] font-[820] text-white'}>
                  {match.result.toUpperCase()}
                </div>
                <div className="text-[12px] text-slate-500">{money(match.payout)}</div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" fullWidth>
          <Share2 className="h-4 w-4" />
          Share profile
        </Button>
        <Button variant="danger" fullWidth onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
