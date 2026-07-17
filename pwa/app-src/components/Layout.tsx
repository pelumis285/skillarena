import React from 'react';
import { cn } from '../lib/utils';
import { Home, LayoutDashboard, Swords, Trophy, User, Wallet } from 'lucide-react';
import type { User as UserType } from '../lib/types';

const NAV = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'challenges', label: 'Arena', icon: Swords },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'profile', label: 'Profile', icon: User },
] as const;

const EXTRA = [
  { id: 'leaderboard', label: 'Ranks', icon: Trophy },
  { id: 'admin', label: 'Admin', icon: LayoutDashboard },
] as const;

export function AppShell({
  user,
  view,
  setView,
  children,
}:{
  user: UserType,
  balance: number,
  view: string,
  setView: (v:any)=>void,
  onLogout: ()=>void,
  children: React.ReactNode
}) {
  const navItems = user.role === 'admin' ? [...NAV, EXTRA[1]] : NAV;

  return (
    <div className="app-safe-shell min-h-[100dvh] bg-transparent">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="skill-wordmark">CEREBRUM</div>
        <main className="min-w-0 pt-4">
          {children}
        </main>
      </div>

      <div className="app-safe-bottom-nav fixed bottom-0 left-1/2 z-40 w-[calc(100vw-0.75rem)] max-w-[430px] -translate-x-1/2 px-2 sm:px-4">
        <div className={cn(
          'grid rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_-12px_36px_rgba(0,0,0,0.28)] sm:px-4 sm:py-3',
          navItems.length > 4 ? 'grid-cols-5' : 'grid-cols-4',
        )}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className="flex min-w-0 flex-col items-center gap-1 rounded-[1.4rem] px-1 py-2"
              >
                <Icon className={cn('h-[18px] w-[18px] sm:h-5 sm:w-5', active ? 'text-[var(--lime)]' : 'text-[var(--muted)]')} />
                <span className={cn('text-[10px] font-[700] tracking-[-0.02em] sm:text-[11px]', active ? 'text-[var(--lime)]' : 'text-[var(--muted)]')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
