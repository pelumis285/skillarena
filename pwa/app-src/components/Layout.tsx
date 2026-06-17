import React from 'react';
import { cn, money } from '../lib/utils';
import { Home, Swords, Trophy, Wallet, User } from 'lucide-react';
import type { User as UserType } from '../lib/types';

const NAV = [
  { id:'dashboard', label:'Home', icon: Home },
  { id:'challenges', label:'Play', icon: Swords },
  { id:'leaderboard', label:'Ranks', icon: Trophy },
  { id:'wallet', label:'Wallet', icon: Wallet },
  { id:'profile', label:'Profile', icon: User },
] as const;

export function AppShell({
  user, balance, view, setView, children
}:{
  user: UserType,
  balance: number,
  view: string,
  setView: (v:any)=>void,
  onLogout: ()=>void,
  children: React.ReactNode
}) {
  return (
    <div className="app-safe-shell min-h-[100dvh]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-8rem] h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/[0.18] blur-3xl" />
        <div className="absolute bottom-10 right-[8%] h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto min-h-[100dvh] max-w-[430px] px-4 pb-28 pt-4">
        <div className="mb-4 flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-lg shadow-[0_12px_30px_rgba(99,102,241,0.35)]">
              {user.avatar}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">SkillArena</div>
              <div className="text-[14px] font-[700] text-white">{user.displayName}</div>
            </div>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.12] px-3 py-1.5 text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Cash</div>
            <div className="text-[13px] font-[700] text-emerald-100">{money(balance)}</div>
          </div>
        </div>

        <main className="relative">
          {children}
        </main>
      </div>

      <div className="app-safe-bottom-nav fixed bottom-0 left-1/2 z-40 w-[min(430px,calc(100vw-1rem))] -translate-x-1/2 px-4">
        <div className="mb-2 rounded-[28px] border border-white/10 bg-[#111a30]/88 px-4 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    'relative flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-[700] transition',
                    active ? 'text-white' : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  <span className={cn(
                    'absolute inset-0 rounded-2xl transition',
                    active ? 'bg-indigo-500/[0.18]' : 'bg-transparent',
                  )} />
                  <Icon className={cn('relative z-10 h-5 w-5', active ? 'text-indigo-300' : 'text-current')} />
                  <span className="relative z-10">{item.label}</span>
                  {active && <span className="relative z-10 h-1 w-1 rounded-full bg-indigo-300" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
