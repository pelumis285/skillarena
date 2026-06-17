import React from 'react';
import { cn } from '../lib/utils';
import { Button, GlassCard } from './ui';

type Accent = 'amber' | 'sky' | 'slate' | 'emerald' | 'lime';

const HERO_ACCENTS: Record<Accent, { border: string; wash: string; orb: string }> = {
  amber: {
    border: 'border-amber-300/20',
    wash: 'from-amber-400/22 via-orange-400/12 to-rose-500/6',
    orb: 'bg-amber-400/18',
  },
  sky: {
    border: 'border-sky-300/20',
    wash: 'from-sky-400/22 via-indigo-400/14 to-violet-500/8',
    orb: 'bg-sky-400/16',
  },
  slate: {
    border: 'border-slate-300/18',
    wash: 'from-slate-200/16 via-slate-400/10 to-zinc-500/6',
    orb: 'bg-slate-300/12',
  },
  emerald: {
    border: 'border-emerald-300/20',
    wash: 'from-emerald-400/20 via-teal-400/12 to-cyan-500/8',
    orb: 'bg-emerald-400/16',
  },
  lime: {
    border: 'border-lime-300/20',
    wash: 'from-lime-400/20 via-emerald-400/12 to-sky-500/8',
    orb: 'bg-lime-400/16',
  },
};

export const gameFieldClass =
  'bg-white/[0.06] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-400/20';

export const gameSelectClass =
  'w-full rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-3 text-[14px] text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-60';

export const gameInfoCardClass =
  'rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-4 text-slate-200';

export const gameInfoTileClass =
  'rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3';

export const gamePillClass =
  'border border-white/10 bg-white/[0.08] text-slate-100';

export const gameMutedTextClass = 'text-[13px] text-slate-400';

export function GameScreen({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('mx-auto space-y-5 text-white', className)}>{children}</div>;
}

export function GameHero({
  accent = 'sky',
  eyebrow,
  title,
  subtitle,
  onExit,
  exitLabel = 'Leave table',
  children,
}: {
  accent?: Accent;
  eyebrow: string;
  title: string;
  subtitle: string;
  onExit: () => void;
  exitLabel?: string;
  children?: React.ReactNode;
}) {
  const tone = HERO_ACCENTS[accent];

  return (
    <GlassCard className={cn('relative overflow-hidden bg-[#091120]/94 p-5 sm:p-6', tone.border)}>
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', tone.wash)} />
      <div className={cn('pointer-events-none absolute -right-12 top-[-3rem] h-36 w-36 rounded-full blur-3xl', tone.orb)} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{eyebrow}</div>
            <h1
              className="mt-2 text-[30px] leading-[0.95] tracking-[-0.04em] text-white sm:text-[34px]"
              style={{ fontFamily: 'Fraunces, serif', fontWeight: 620 }}
            >
              {title}
            </h1>
            <div className="mt-3 max-w-[34rem] text-[13.5px] leading-6 text-slate-300">{subtitle}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={onExit}>
            {exitLabel}
          </Button>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </GlassCard>
  );
}

export function GamePanel({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className={cn('border-white/10 bg-[#081121]/86 p-5 text-white', className)}>
      {children}
    </GlassCard>
  );
}
