import React from 'react';
import { betaApi } from '../lib/api';
import type { AdminOverviewSnapshot, User } from '../lib/types';
import { money, timeAgo } from '../lib/utils';
import { Badge, GlassCard } from './ui';
import { Activity, ArrowDownCircle, ArrowUpCircle, Crown, DollarSign, Users } from 'lucide-react';

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'text-white',
}:{
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className={tone + ' mt-2 text-[23px] font-[850] tracking-[-0.04em]'}>{value}</div>
          <div className="mt-1 text-[12px] text-slate-400">{detail}</div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.06]">
          <Icon className={tone + ' h-5 w-5'} />
        </div>
      </div>
    </GlassCard>
  );
}

export function AdminDashboard({
  user,
  refreshKey = 0,
}:{
  user: User;
  refreshKey?: number;
}) {
  const [overview, setOverview] = React.useState<AdminOverviewSnapshot | null>(null);
  const [loading, setLoading] = React.useState(betaApi.isConfigured);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user.role !== 'admin') {
      setOverview(null);
      setLoading(false);
      setError('Admin access is required to view this page.');
      return;
    }
    if (!betaApi.isConfigured) {
      setOverview(null);
      setLoading(false);
      setError('Connect the beta API to load the live admin dashboard.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    betaApi.getAdminOverview(user.id)
      .then((payload) => {
        if (cancelled) return;
        setOverview(payload);
        setError(null);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Admin dashboard is unavailable.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, user.id, user.role]);

  if (!overview) {
    return (
      <div className="space-y-4 pb-6 text-white">
        <div className="px-1">
          <div className="text-[12px] uppercase tracking-[0.24em] text-slate-500">Control room</div>
          <h2 className="mt-1 text-[30px] font-[850] tracking-[-0.04em]">Admin Dashboard</h2>
        </div>
        <GlassCard className="p-5 text-[13px] text-slate-300">
          {loading ? 'Loading the live admin dashboard…' : error ?? 'Admin dashboard is not ready yet.'}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-white">
      <div className="px-1">
        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-500">Control room</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 className="text-[30px] font-[850] tracking-[-0.04em]">Admin Dashboard</h2>
          {loading && <Badge variant="default">Refreshing…</Badge>}
        </div>
        <div className="mt-1 text-[13px] text-slate-400">Track registrations, balances, deposits, withdrawals, referrals, and platform revenue in one live view.</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Users" value={String(overview.totals.users)} detail={`${overview.totals.activeUsers} active now`} icon={Users} />
        <StatCard label="Funded" value={String(overview.totals.fundedUsers)} detail={`${overview.totals.referredUsers} came from referrals`} icon={Activity} tone="text-indigo-200" />
        <StatCard label="Deposits" value={money(overview.totals.totalDeposited)} detail={`Balances holding ${money(overview.totals.totalBalances)}`} icon={ArrowDownCircle} tone="text-emerald-300" />
        <StatCard label="Withdrawals" value={money(overview.totals.totalWithdrawn)} detail={`${overview.totals.totalReferralPoints} referral points awarded`} icon={ArrowUpCircle} tone="text-amber-200" />
        <StatCard label="Wagered" value={money(overview.totals.totalWagered)} detail={`${money(overview.totals.totalPayouts)} paid out to players`} icon={DollarSign} />
        <StatCard label="Revenue" value={money(overview.totals.platformRevenue)} detail={`${money(overview.totals.totalReferralRewards)} paid as referral rewards`} icon={Crown} tone="text-fuchsia-200" />
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent platform movement</div>
            <div className="text-[12px] text-slate-500">Daily deposits, withdrawals, wins and losses.</div>
          </div>
          <Badge variant="gold">{overview.trends.length} points</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {overview.trends.map((point) => (
            <div key={point.label} className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-[760]">{point.label}</div>
                  <div className="mt-1 text-[12px] text-slate-400">{point.wins} wins • {point.losses} losses</div>
                </div>
                <div className="text-right text-[12px] text-slate-400">
                  <div className="text-emerald-300">Deposits {money(point.deposits)}</div>
                  <div>Withdrawals {money(point.withdrawals)}</div>
                  <div className="text-fuchsia-200">Revenue {money(point.platformRevenue)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[18px] font-[800] tracking-[-0.03em]">Top players</div>
              <div className="text-[12px] text-slate-500">Best performing accounts by wins and earnings.</div>
            </div>
            <Badge variant="emerald">{overview.topPlayers.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {overview.topPlayers.map((player) => (
              <div key={player.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div>
                  <div className="text-[14px] font-[760]">{player.displayName}</div>
                  <div className="text-[12px] text-slate-400">@{player.username} • {player.wins} wins • {player.losses} losses</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-[820] text-emerald-300">{money(player.earned)}</div>
                  <div className="text-[11px] text-slate-500">{player.role}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[18px] font-[800] tracking-[-0.03em]">Top referrers</div>
              <div className="text-[12px] text-slate-500">Players bringing the most growth into the platform.</div>
            </div>
            <Badge variant="purple">{overview.topReferrers.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {overview.topReferrers.map((player) => (
              <div key={player.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div>
                  <div className="text-[14px] font-[760]">{player.displayName}</div>
                  <div className="text-[12px] text-slate-400">@{player.username} • {player.referralCount} referrals</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-[820] text-amber-200">{money(player.referralEarnings)}</div>
                  <div className="text-[11px] text-slate-500">{player.referralPoints} pts</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent transactions</div>
            <div className="text-[12px] text-slate-500">Newest ledger activity across all users.</div>
          </div>
          <Badge variant="rose">{overview.recentTransactions.length} latest</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {overview.recentTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div>
                <div className="text-[14px] font-[760]">{tx.displayName}</div>
                <div className="text-[12px] text-slate-400">@{tx.username} • {tx.description} • {timeAgo(tx.at)}</div>
              </div>
              <div className="text-right">
                <div className={tx.amount >= 0 ? 'text-[14px] font-[820] text-emerald-300' : 'text-[14px] font-[820] text-white'}>
                  {money(tx.amount)}
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{tx.status}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Accounts</div>
            <div className="text-[12px] text-slate-500">Full player ledger summary for operations and support.</div>
          </div>
          <Badge variant="default">{overview.users.length} accounts</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {overview.users.map((player) => (
            <div key={player.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-[760]">{player.displayName}</div>
                  <div className="text-[12px] text-slate-400">@{player.username} • joined {timeAgo(player.joinedAt)} • {player.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-[820] text-white">{money(player.balance)}</div>
                  <div className="text-[11px] text-slate-500">live balance</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-slate-300">
                <div>Deposited {money(player.deposited)}</div>
                <div>Withdrawn {money(player.withdrawn)}</div>
                <div>Wagered {money(player.wagered)}</div>
                <div>Earned {money(player.earned)}</div>
                <div>{player.referralCount} referrals</div>
                <div>{player.referralPoints} referral pts</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
