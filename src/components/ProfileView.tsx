import React from 'react';
import { betaApi } from '../lib/api';
import type { User, UserProfileSnapshot } from '../lib/types';
import { money, timeAgo } from '../lib/utils';
import { Badge, Button, GlassCard } from './ui';
import { Copy, Gift, LogOut, Share2, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react';

function buildFallbackProfile(user: User, balance: number): UserProfileSnapshot {
  return {
    user,
    balance,
    totals: {
      deposited: 0,
      withdrawn: 0,
      wagered: 0,
      earned: 0,
      net: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      referrals: 0,
      referralPoints: 0,
      referralEarnings: 0,
    },
    transactions: [],
    matches: [],
    performance: [],
    referral: {
      code: user.referralCode ?? user.username.toUpperCase(),
      referredByCode: user.referredByCode ?? null,
      rewardPerFriend: 2,
      pointsPerFriend: 50,
      friends: [],
    },
  };
}

export function ProfileView({
  user,
  balance,
  refreshKey = 0,
  onLogout,
}:{
  user: User;
  balance: number;
  refreshKey?: number;
  onLogout:()=>void;
}) {
  const [profile, setProfile] = React.useState<UserProfileSnapshot>(() => buildFallbackProfile(user, balance));
  const [loading, setLoading] = React.useState(betaApi.isConfigured);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProfile(buildFallbackProfile(user, balance));
  }, [balance, user]);

  React.useEffect(() => {
    if (!betaApi.isConfigured) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    betaApi.getProfile(user.id)
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setError(null);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Profile is unavailable right now.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, user.id]);

  const winRate = profile.totals.matchesPlayed
    ? Math.round((profile.totals.wins / profile.totals.matchesPlayed) * 100)
    : 0;

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.referral.code);
    } catch {
      // Ignore clipboard issues on older webviews.
    }
  };

  const shareReferralCode = async () => {
    const message = `Join me on SkillArena with referral code ${profile.referral.code} and start playing.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SkillArena invite', text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
    } catch {
      // Ignore share cancellations.
    }
  };

  return (
    <div className="space-y-6 pb-6 text-white">
      <GlassCard className="overflow-hidden p-5">
        <div className="absolute right-[-2rem] top-[-1rem] h-24 w-24 rounded-full bg-indigo-400/[0.14] blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <div className="rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-[3px] shadow-[0_20px_40px_rgba(99,102,241,0.3)]">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-[#09101d] text-[44px]">{profile.user.avatar}</div>
          </div>
          <div className="mt-4 text-[29px] font-[850] tracking-[-0.04em]">{profile.user.displayName}</div>
          <div className="mt-1 text-[13px] text-slate-400">@{profile.user.username} • Joined {new Date(profile.user.joinedAt).getFullYear()}</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="purple">{profile.user.tier}</Badge>
            <Badge variant="emerald">{profile.user.rating} Elo</Badge>
            <Badge variant="gold">{profile.user.role === 'admin' ? 'Admin' : 'Player'}</Badge>
          </div>
          {error && (
            <div className="mt-3 rounded-full border border-amber-300/25 bg-amber-300/12 px-3 py-1 text-[11px] text-amber-100">
              {error}
            </div>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Balance', value: money(profile.balance), tone: 'text-emerald-300', icon: Wallet },
          { label: 'Matches', value: String(profile.totals.matchesPlayed), tone: 'text-white', icon: TrendingUp },
          { label: 'Win rate', value: `${winRate}%`, tone: 'text-indigo-200', icon: Sparkles },
          { label: 'Referral points', value: String(profile.totals.referralPoints), tone: 'text-amber-200', icon: Users },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4 text-center">
            <stat.icon className={stat.tone + ' mx-auto h-4 w-4'} />
            <div className={stat.tone + ' mt-2 text-[21px] font-[850] tracking-[-0.04em]'}>{stat.value}</div>
            <div className="text-[11px] text-slate-500">{stat.label}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Referral Vault</div>
            <div className="mt-1 text-[12px] text-slate-400">Invite friends and earn cash plus points every time a new player joins with your code.</div>
          </div>
          <Badge variant="emerald">
            <Gift className="h-3.5 w-3.5" />
            {money(profile.totals.referralEarnings)}
          </Badge>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Your code</div>
          <div className="mt-2 text-[24px] font-[900] tracking-[0.2em] text-white">{profile.referral.code}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-slate-300">
            <span>{money(profile.referral.rewardPerFriend)} per friend</span>
            <span>•</span>
            <span>{profile.referral.pointsPerFriend} points bonus</span>
            {profile.referral.referredByCode && (
              <>
                <span>•</span>
                <span>Joined via {profile.referral.referredByCode}</span>
              </>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={copyReferralCode}>
              <Copy className="h-4 w-4" />
              Copy code
            </Button>
            <Button variant="gold" fullWidth onClick={shareReferralCode}>
              <Share2 className="h-4 w-4" />
              Share invite
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Deposited</div>
            <div className="mt-2 text-[18px] font-[820] text-white">{money(profile.totals.deposited)}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Withdrawn</div>
            <div className="mt-2 text-[18px] font-[820] text-white">{money(profile.totals.withdrawn)}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Net play</div>
            <div className={profile.totals.net >= 0 ? 'mt-2 text-[18px] font-[820] text-emerald-300' : 'mt-2 text-[18px] font-[820] text-rose-200'}>
              {money(profile.totals.net)}
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Referred friends</div>
            <div className="text-[12px] text-slate-500">Anyone who signs up with your code lands here.</div>
          </div>
          <Badge variant="gold">{profile.referral.friends.length} joined</Badge>
        </div>

        {profile.referral.friends.length ? profile.referral.friends.map((friend) => (
          <GlassCard key={friend.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-[760]">{friend.displayName}</div>
                <div className="text-[12px] text-slate-400">@{friend.username} • joined {timeAgo(friend.joinedAt)}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-[820] text-emerald-300">{money(friend.rewardAmount)}</div>
                <div className="text-[11px] text-amber-200">+{friend.rewardPoints} pts</div>
              </div>
            </div>
          </GlassCard>
        )) : (
          <GlassCard className="p-4 text-[13px] text-slate-400">
            No referrals yet. Share your code to start earning referral cash and bonus points.
          </GlassCard>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent match log</div>
            <div className="text-[12px] text-slate-500">Real game results and payouts from your latest sessions.</div>
          </div>
          {loading && <Badge variant="default">Updating…</Badge>}
        </div>

        {profile.matches.length ? profile.matches.map((match) => (
          <GlassCard key={match.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.08] text-lg">{match.opponent.avatar}</div>
                <div>
                  <div className="text-[14px] font-[760]">{match.opponent.name}</div>
                  <div className="text-[12px] text-slate-400">{match.game} • {match.score} • {timeAgo(match.at)}</div>
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
        )) : (
          <GlassCard className="p-4 text-[13px] text-slate-400">
            No settled matches yet. Once you play, your wins, losses, and payouts will show here.
          </GlassCard>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" fullWidth onClick={shareReferralCode}>
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
