import React from 'react';
import { betaApi } from '../lib/api';
import type { AdminOverviewSnapshot, User } from '../lib/types';
import { money, timeAgo } from '../lib/utils';
import { Badge } from './ui';
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Crown,
  DollarSign,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}:{
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-[1.35rem] bg-[#f8f8fb] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className={`grid h-11 w-11 place-items-center rounded-full ${tone}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="mt-3 text-[11px] font-[800] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-[1.45rem] font-[850] leading-none tracking-[-0.04em] text-slate-900">{value}</div>
      <div className="mt-2 text-[12px] leading-5 text-slate-500">{detail}</div>
    </div>
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
      <div className="mx-auto max-w-[38rem] pb-6 text-slate-900">
        <div className="overflow-hidden rounded-[2.3rem] border border-white/6 bg-[linear-gradient(180deg,#f7f2fd_0%,#f4efe7_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <div className="text-[11px] font-[800] uppercase tracking-[0.18em] text-slate-500">Control room</div>
          <div className="mt-3 text-[2rem] font-[850] leading-none tracking-[-0.05em] text-slate-900">Admin dashboard</div>
          <div className="mt-2 max-w-[22rem] text-[13px] leading-6 text-slate-500">
            {loading ? 'Loading the live admin dashboard…' : error ?? 'Admin dashboard is not ready yet.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[38rem] pb-6 text-slate-900">
      <div className="overflow-hidden rounded-[2.3rem] border border-white/6 bg-[linear-gradient(180deg,#f7f2fd_0%,#f4efe7_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-5">
        <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#101217_0%,#2d1f4c_56%,#6b42d8_100%)] px-5 py-5 text-white shadow-[0_22px_44px_rgba(33,19,68,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-[800] uppercase tracking-[0.18em] text-white/68">Control room</div>
              <div className="mt-3 text-[2.05rem] font-[850] leading-[0.98] tracking-[-0.06em]">Admin dashboard</div>
              <div className="mt-2 max-w-[16rem] text-[13px] leading-6 text-white/70">
                Live visibility into balances, payments, referrals, users, and platform profit.
              </div>
            </div>
            <div className="rounded-[1.15rem] bg-white/12 px-3 py-2 text-right backdrop-blur-xl">
              <div className="text-[10px] font-[800] uppercase tracking-[0.16em] text-white/68">Role</div>
              <div className="mt-1 text-[14px] font-[820]">Admin</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[1.3rem] bg-white/10 px-4 py-3">
              <div className="text-[10px] font-[800] uppercase tracking-[0.16em] text-white/65">Platform revenue</div>
              <div className="mt-2 text-[1.65rem] font-[850] tracking-[-0.05em]">{money(overview.totals.platformRevenue)}</div>
            </div>
            <div className="rounded-[1.3rem] bg-white/10 px-4 py-3">
              <div className="text-[10px] font-[800] uppercase tracking-[0.16em] text-white/65">Live balances</div>
              <div className="mt-2 text-[1.65rem] font-[850] tracking-[-0.05em]">{money(overview.totals.totalBalances)}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.3rem] bg-white/8 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-[800] uppercase tracking-[0.16em] text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-lime-300" />
              {loading ? 'Refreshing live data' : 'Live ledger connected'}
            </div>
            <div className="text-[12px] text-white/72">{overview.totals.activeUsers} active now</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetricCard label="Users" value={String(overview.totals.users)} detail={`${overview.totals.admins} admins on deck`} icon={Users} tone="bg-sky-100 text-sky-700" />
          <MetricCard label="Funded" value={String(overview.totals.fundedUsers)} detail={`${overview.totals.referredUsers} referred players`} icon={Activity} tone="bg-violet-100 text-violet-700" />
          <MetricCard label="Deposits" value={money(overview.totals.totalDeposited)} detail={`Holding ${money(overview.totals.totalBalances)} in balances`} icon={ArrowDownCircle} tone="bg-emerald-100 text-emerald-700" />
          <MetricCard label="Withdrawals" value={money(overview.totals.totalWithdrawn)} detail={`${overview.totals.totalReferralPoints} referral points awarded`} icon={ArrowUpCircle} tone="bg-amber-100 text-amber-700" />
          <MetricCard label="Wagered" value={money(overview.totals.totalWagered)} detail={`${money(overview.totals.totalPayouts)} paid out to players`} icon={DollarSign} tone="bg-slate-100 text-slate-700" />
          <MetricCard label="Referral rewards" value={money(overview.totals.totalReferralRewards)} detail={`${money(overview.totals.platformRevenue)} profit kept by platform`} icon={Crown} tone="bg-rose-100 text-rose-700" />
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Money rails</div>
              <div className="mt-1 text-[12px] text-slate-500">The key cash lanes moving through the arena right now.</div>
            </div>
            <Badge variant="emerald">NGN</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {[
              {
                label: 'Deposits',
                value: money(overview.totals.totalDeposited),
                detail: 'All confirmed top-ups from players.',
                icon: Wallet,
                tone: 'bg-emerald-100 text-emerald-700',
              },
              {
                label: 'Withdrawals',
                value: money(overview.totals.totalWithdrawn),
                detail: 'Cash-out requests and settled payouts.',
                icon: ArrowUpCircle,
                tone: 'bg-amber-100 text-amber-700',
              },
              {
                label: 'Revenue',
                value: money(overview.totals.platformRevenue),
                detail: 'Platform net after payouts and referral rewards.',
                icon: TrendingUp,
                tone: 'bg-violet-100 text-violet-700',
              },
            ].map((lane) => (
              <div key={lane.label} className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-[#f8f8fb] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`grid h-12 w-12 place-items-center rounded-full ${lane.tone}`}>
                    <lane.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[14px] font-[800] text-slate-900">{lane.label}</div>
                    <div className="text-[12px] text-slate-500">{lane.detail}</div>
                  </div>
                </div>
                <div className="text-right text-[15px] font-[850] tracking-[-0.03em] text-slate-900">{lane.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Recent platform movement</div>
              <div className="mt-1 text-[12px] text-slate-500">Daily deposits, withdrawals, wins, and losses.</div>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-[800] uppercase tracking-[0.12em] text-slate-600">
              {overview.trends.length} points
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {overview.trends.map((point) => (
              <div key={point.label} className="rounded-[1.35rem] bg-[#f8f8fb] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-[800] text-slate-900">{point.label}</div>
                    <div className="mt-1 text-[12px] text-slate-500">{point.wins} wins • {point.losses} losses</div>
                  </div>
                  <Sparkles className="h-4 w-4 text-violet-500" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  <div className="rounded-[1rem] bg-white px-3 py-2 text-slate-600">
                    <div className="font-[700] text-emerald-700">{money(point.deposits)}</div>
                    <div>Deposits</div>
                  </div>
                  <div className="rounded-[1rem] bg-white px-3 py-2 text-slate-600">
                    <div className="font-[700] text-amber-700">{money(point.withdrawals)}</div>
                    <div>Withdrawals</div>
                  </div>
                  <div className="rounded-[1rem] bg-white px-3 py-2 text-slate-600">
                    <div className="font-[700] text-violet-700">{money(point.platformRevenue)}</div>
                    <div>Revenue</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Top players</div>
                <div className="mt-1 text-[12px] text-slate-500">Best performing accounts by wins and earnings.</div>
              </div>
              <Badge variant="emerald">{overview.topPlayers.length}</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {overview.topPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-[#f8f8fb] px-4 py-3">
                  <div>
                    <div className="text-[14px] font-[800] text-slate-900">{player.displayName}</div>
                    <div className="text-[12px] text-slate-500">@{player.username} • {player.wins} wins • {player.losses} losses</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-[820] text-emerald-600">{money(player.earned)}</div>
                    <div className="text-[11px] text-slate-500">{player.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Top referrers</div>
                <div className="mt-1 text-[12px] text-slate-500">Players bringing the most growth into the platform.</div>
              </div>
              <Badge variant="purple">{overview.topReferrers.length}</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {overview.topReferrers.map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-[#f8f8fb] px-4 py-3">
                  <div>
                    <div className="text-[14px] font-[800] text-slate-900">{player.displayName}</div>
                    <div className="text-[12px] text-slate-500">@{player.username} • {player.referralCount} referrals</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-[820] text-amber-700">{money(player.referralEarnings)}</div>
                    <div className="text-[11px] text-slate-500">{player.referralPoints} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Recent transactions</div>
              <div className="mt-1 text-[12px] text-slate-500">Newest ledger activity across all users.</div>
            </div>
            <Badge variant="rose">{overview.recentTransactions.length} latest</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {overview.recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-[#f8f8fb] px-4 py-3">
                <div>
                  <div className="text-[14px] font-[800] text-slate-900">{tx.displayName}</div>
                  <div className="text-[12px] text-slate-500">@{tx.username} • {tx.description} • {timeAgo(tx.at)}</div>
                </div>
                <div className="text-right">
                  <div className={tx.amount >= 0 ? 'text-[14px] font-[820] text-emerald-600' : 'text-[14px] font-[820] text-slate-900'}>
                    {money(tx.amount)}
                  </div>
                  <div className="text-[10px] font-[800] uppercase tracking-[0.12em] text-slate-500">{tx.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Accounts</div>
              <div className="mt-1 text-[12px] text-slate-500">Full player ledger summary for operations and support.</div>
            </div>
            <Badge variant="default">{overview.users.length} accounts</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {overview.users.map((player) => (
              <div key={player.id} className="rounded-[1.35rem] bg-[#f8f8fb] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-[800] text-slate-900">{player.displayName}</div>
                    <div className="text-[12px] text-slate-500">@{player.username} • joined {timeAgo(player.joinedAt)} • {player.role}</div>
                    <div className="mt-1 text-[12px] text-slate-500">{[player.firstName, player.lastName].filter(Boolean).join(' ') || 'Name pending'} • {player.email}</div>
                    <div className="mt-1 text-[12px] text-slate-500">{player.phone || 'Phone pending'} • {player.country || 'Country pending'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-[820] text-slate-900">{money(player.balance)}</div>
                    <div className="text-[11px] text-slate-500">live balance</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </div>
    </div>
  );
}
