import React from 'react';
import { betaApi } from '../lib/api';
import { DEFAULT_REFERRAL_REWARD_AMOUNT, PRIMARY_LOCALE } from '../lib/market';
import type { User, UserProfileSnapshot } from '../lib/types';
import { money, timeAgo } from '../lib/utils';
import { Badge, Button, Field, Modal } from './ui';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Copy,
  Crown,
  Gift,
  Globe2,
  IdCard,
  ImagePlus,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Sword,
  Trophy,
  UserRoundPen,
  Wallet,
  X,
} from 'lucide-react';

const PROFILE_AVATARS = ['🦊', '🦁', '🐯', '🦅', '🐺', '🦄', '🐬', '🐝'];

type ProfilePanelId = 'settings' | 'facts' | 'referrals' | 'matches' | 'share';
type FeedbackState = { type: 'success' | 'error'; message: string } | null;

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
      rewardPerFriend: DEFAULT_REFERRAL_REWARD_AMOUNT,
      pointsPerFriend: 50,
      friends: [],
    },
  };
}

function formatAccountDate(value: string) {
  if (!value) return 'Not added yet';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(PRIMARY_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatJoinDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently joined';
  return parsed.toLocaleDateString(PRIMARY_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDisplayInitial(user: User) {
  return user.displayName.trim().charAt(0) || user.username.trim().charAt(0) || 'P';
}

function isImageValue(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|data:image\/)/.test(value);
}

function resolveProfileVisual(user: User) {
  if (isImageValue(user.profileImage)) return user.profileImage ?? null;
  if (isImageValue(user.avatar)) return user.avatar;
  return null;
}

function getProfileShareUrl(user: User) {
  if (typeof window === 'undefined') {
    return `https://skillarena.app/player/${encodeURIComponent(user.username)}`;
  }
  const url = new URL(window.location.origin);
  url.searchParams.set('player', user.username);
  return url.toString();
}

function getVerificationLabel(user: User) {
  if (user.email.endsWith('.test')) return 'Demo account';
  return 'Email linked';
}

function getFairPlayLabel(profile: UserProfileSnapshot) {
  if (profile.totals.matchesPlayed === 0) return 'New player';
  return 'Good standing';
}

type ProfileViewProps = {
  user: User;
  balance: number;
  toast: (message: string) => void;
  refreshKey?: number;
  onLogout: () => void;
  onUserChange?: (user: User) => void;
};

export function ProfileView({
  user,
  balance,
  toast,
  refreshKey = 0,
  onLogout,
  onUserChange,
}: ProfileViewProps) {
  const [profile, setProfile] = React.useState<UserProfileSnapshot>(() => buildFallbackProfile(user, balance));
  const [loading, setLoading] = React.useState(betaApi.isConfigured);
  const [error, setError] = React.useState<string | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<ProfilePanelId | null>(null);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [editBusy, setEditBusy] = React.useState(false);
  const [settingsFeedback, setSettingsFeedback] = React.useState<FeedbackState>(null);

  const [editDisplayName, setEditDisplayName] = React.useState(user.displayName);
  const [editCountry, setEditCountry] = React.useState(user.country);
  const [avatarMode, setAvatarMode] = React.useState<'avatar' | 'picture'>(user.profileImage ? 'picture' : 'avatar');
  const [selectedAvatar, setSelectedAvatar] = React.useState(user.avatar || PROFILE_AVATARS[0]);
  const [profileImageDraft, setProfileImageDraft] = React.useState<string | null>(user.profileImage ?? null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const menuDrawerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setProfile(buildFallbackProfile(user, balance));
  }, [balance, user]);

  React.useEffect(() => {
    setEditDisplayName(profile.user.displayName);
    setEditCountry(profile.user.country);
    setSelectedAvatar(profile.user.avatar || PROFILE_AVATARS[0]);
    setProfileImageDraft(profile.user.profileImage ?? null);
    setAvatarMode(profile.user.profileImage ? 'picture' : 'avatar');
  }, [profile.user]);

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

  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && menuDrawerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const winRate = profile.totals.matchesPlayed
    ? Math.round((profile.totals.wins / profile.totals.matchesPlayed) * 100)
    : 0;
  const legalName = [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ') || 'Not added yet';
  const profileVisual = resolveProfileVisual(profile.user);
  const recentPreviewMatches = profile.matches.slice(0, 2);
  const profileShareUrl = getProfileShareUrl(profile.user);

  const resetProfileDrafts = React.useCallback(() => {
    setEditDisplayName(profile.user.displayName);
    setEditCountry(profile.user.country);
    setSelectedAvatar(profile.user.avatar || PROFILE_AVATARS[0]);
    setProfileImageDraft(profile.user.profileImage ?? null);
    setAvatarMode(profile.user.profileImage ? 'picture' : 'avatar');
    setSettingsFeedback(null);
  }, [profile.user]);

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.referral.code);
      toast('Referral code copied.');
    } catch {
      toast('We could not copy the referral code on this device.');
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
      toast('Invite message copied. Share it with your friends.');
    } catch {
      toast('Invite sharing was cancelled.');
    }
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileShareUrl);
      toast('Profile link copied.');
    } catch {
      toast('We could not copy your profile link on this device.');
    }
  };

  const shareProfile = async () => {
    const shareText = `Check out ${profile.user.displayName} on SkillArena. ${profileShareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.user.displayName} on SkillArena`,
          text: shareText,
          url: profileShareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      toast('Profile share message copied.');
    } catch {
      toast('Profile sharing was cancelled.');
    }
  };

  const openPanel = (panel: ProfilePanelId) => {
    setMenuOpen(false);
    if (panel === 'settings') resetProfileDrafts();
    window.setTimeout(() => setActivePanel(panel), 120);
  };

  const closePanel = () => {
    if (activePanel === 'settings') resetProfileDrafts();
    setActivePanel(null);
  };

  const handlePickProfileImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setSettingsFeedback({ type: 'error', message: 'Please pick a smaller image, around 1.5MB or less.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setProfileImageDraft(result);
      setAvatarMode('picture');
      setSettingsFeedback(null);
    };
    reader.readAsDataURL(file);
  };

  const saveProfileChanges = async () => {
    const nextDisplayName = editDisplayName.trim();
    const nextCountry = editCountry.trim();

    if (!nextDisplayName) {
      setSettingsFeedback({ type: 'error', message: 'Display name is required.' });
      return;
    }
    if (!nextCountry) {
      setSettingsFeedback({ type: 'error', message: 'Country is required.' });
      return;
    }
    if (avatarMode === 'picture' && !profileImageDraft) {
      setSettingsFeedback({ type: 'error', message: 'Pick a profile picture or switch back to avatar mode.' });
      return;
    }

    setEditBusy(true);
    setSettingsFeedback(null);
    try {
      const input = {
        displayName: nextDisplayName,
        country: nextCountry,
        phone: profile.user.phone,
        avatar: selectedAvatar,
        profileImage: avatarMode === 'picture' ? profileImageDraft : null,
      };

      if (betaApi.isConfigured) {
        const payload = await betaApi.updateProfile(profile.user.id, input);
        setProfile(payload.profile);
        onUserChange?.(payload.user);
      } else {
        const nextUser: User = {
          ...profile.user,
          ...input,
        };
        setProfile((current) => ({ ...current, user: nextUser }));
        onUserChange?.(nextUser);
      }

      setSettingsFeedback({ type: 'success', message: 'Changes saved successfully.' });
      toast('Profile updated.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not update the profile.';
      setSettingsFeedback({ type: 'error', message });
      toast(message);
    } finally {
      setEditBusy(false);
    }
  };

  const menuItems = [
    { id: 'settings' as const, label: 'Profile Settings', description: 'Avatar, picture, name, and locked account details.' },
    { id: 'facts' as const, label: 'Account Facts', description: 'Player ID, joined date, rating, and record.' },
    { id: 'referrals' as const, label: 'Refer Friends', description: 'Referral code, rewards, and successful invites.' },
    { id: 'matches' as const, label: 'Recent Match Log', description: 'Latest results, scores, stakes, and payouts.' },
    { id: 'share' as const, label: 'Share Profile', description: 'Copy or share your public player card.' },
  ];

  return (
    <div className="mx-auto max-w-[32rem] pb-6 text-slate-900">
      <div className="overflow-hidden rounded-[2.4rem] border border-white/6 bg-[linear-gradient(180deg,#f8f3fb_0%,#f6efe7_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,#8c4cf2_0%,#f18f7d_48%,#ffd18f_100%)] px-4 pb-16 pt-4 sm:px-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_30%),radial-gradient(circle_at_80%_24%,rgba(255,223,186,0.26),transparent_24%),radial-gradient(circle_at_70%_78%,rgba(131,76,242,0.22),transparent_26%)]" />
          <div className="absolute bottom-[-3rem] left-[-2rem] h-40 w-32 rotate-[18deg] rounded-[3rem] bg-[#7e3044]/55 blur-[2px]" />
          <div className="absolute bottom-[-2rem] right-[-1rem] h-32 w-32 rounded-full border border-white/18 bg-white/12" />
          <div className="relative flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-800 shadow-[0_12px_26px_rgba(15,23,42,0.08)] transition hover:bg-slate-50"
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/18 px-3 py-2 text-[11px] font-[800] uppercase tracking-[0.16em] text-white backdrop-blur-xl">
                {loading ? 'Syncing' : 'Profile'}
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white/14 text-white shadow-[0_12px_26px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <Bell className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="relative mt-10 flex justify-center">
            <div className="rounded-full bg-white p-1 shadow-[0_18px_35px_rgba(0,0,0,0.18)]">
              <div className="rounded-full bg-[linear-gradient(135deg,#ffd56f_0%,#ffa75e_100%)] p-[4px]">
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-[#0f172a] text-[46px] text-white">
                  {profileVisual ? (
                    <img src={profileVisual} alt={profile.user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{profile.user.avatar || getDisplayInitial(profile.user)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-5 pt-6 sm:px-5">
          <div className="text-center">
            <div className="text-[2rem] font-[850] leading-none tracking-[-0.06em] text-slate-900">{profile.user.displayName}</div>
            <div className="mt-2 text-[14px] font-[700] text-slate-600">@{profile.user.username}</div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="gold">{profile.user.role === 'admin' ? 'Admin' : profile.user.tier}</Badge>
              <Badge variant="purple">{profile.user.rating} rating</Badge>
              <Badge variant="emerald">{winRate}% win rate</Badge>
            </div>
            <div className="mt-4 text-[14px] leading-6 text-slate-600">
              Keep your player identity sharp, track your record, and manage account details from the profile menu.
            </div>
            {error ? (
              <div className="mt-4 rounded-[1.1rem] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-[700] text-amber-800">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { label: 'Wallet', value: money(profile.balance), icon: Wallet, tone: 'bg-indigo-50 text-indigo-700' },
              { label: 'Games played', value: String(profile.totals.matchesPlayed), icon: Trophy, tone: 'bg-amber-50 text-amber-700' },
              { label: 'Wins', value: String(profile.totals.wins), icon: Sparkles, tone: 'bg-emerald-50 text-emerald-700' },
              { label: 'Skill rating', value: String(profile.user.rating), icon: Sword, tone: 'bg-rose-50 text-rose-700' },
            ].map((card) => (
              <div key={card.label} className="rounded-[1.45rem] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
                <div className={`grid h-11 w-11 place-items-center rounded-full ${card.tone}`}>
                  <card.icon className="h-4.5 w-4.5" />
                </div>
                <div className="mt-3 text-[12px] font-[700] text-slate-500">{card.label}</div>
                <div className="mt-1 text-[1.6rem] font-[850] leading-none tracking-[-0.05em] text-slate-900">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-900">Recent activity</div>
                <div className="mt-1 text-[13px] leading-5 text-slate-500">
                  A short preview of your latest arena results.
                </div>
              </div>
              <button
                type="button"
                onClick={() => openPanel('matches')}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-[12px] font-[800] text-slate-800 transition hover:bg-slate-200"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {recentPreviewMatches.length ? recentPreviewMatches.map((match) => (
                <div key={match.id} className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-[#f8f8fb] px-4 py-3">
                  <div>
                    <div className="text-[14px] font-[800] text-slate-900">{match.game} vs {match.opponent.name}</div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      {match.score} • {timeAgo(match.at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={match.result === 'win' ? 'text-[13px] font-[850] text-emerald-700' : match.result === 'draw' ? 'text-[13px] font-[850] text-amber-700' : 'text-[13px] font-[850] text-slate-900'}>
                      {match.result.toUpperCase()}
                    </div>
                    <div className="text-[12px] text-slate-500">{money(match.payout)}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[1.35rem] bg-[#f8f8fb] px-4 py-4 text-[13px] leading-6 text-slate-600">
                  No settled matches yet. Play a game and your latest results will show here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-[65]">
          <div className="absolute inset-0 bg-[#050912]/48 backdrop-blur-[2px]" />
          <div
            ref={menuDrawerRef}
            className="absolute left-0 top-0 flex h-full w-[min(88vw,22rem)] flex-col border-r border-white/12 bg-[#ffffff] shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
              <div>
                <div className="text-[11px] font-[800] uppercase tracking-[0.18em] text-slate-500">Profile menu</div>
                <div className="mt-1 text-[1.35rem] font-[850] tracking-[-0.04em] text-slate-950">{profile.user.displayName}</div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                aria-label="Close profile menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openPanel(item.id)}
                    className="w-full rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-[800] tracking-[-0.02em] text-slate-950">{item.label}</div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-600">{item.description}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4">
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  setMenuOpen(false);
                  window.setTimeout(() => setSignOutOpen(true), 120);
                }}
                className="justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ProfilePanel
        open={activePanel !== null}
        title={
          activePanel === 'settings' ? 'Profile Settings'
            : activePanel === 'facts' ? 'Account Facts'
              : activePanel === 'referrals' ? 'Refer Friends'
                : activePanel === 'matches' ? 'Recent Match Log'
                  : activePanel === 'share' ? 'Share Profile'
                    : ''
        }
        onBack={closePanel}
      >
        {activePanel === 'settings' ? (
          <div className="space-y-5 text-white">
            <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[13px] leading-6 text-slate-200">
              Update how your player card appears. Email, phone number, and birthday stay locked here until a separate verified update flow is added.
            </div>

            {settingsFeedback ? (
              <div className={settingsFeedback.type === 'success'
                ? 'rounded-[1.25rem] border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-[13px] text-emerald-200'
                : 'rounded-[1.25rem] border border-rose-400/30 bg-rose-500/12 px-4 py-3 text-[13px] text-rose-200'}>
                <div className="flex items-center gap-2 font-[700]">
                  {settingsFeedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {settingsFeedback.message}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.6rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-white/12 bg-[var(--surface-2)] text-[38px] text-white">
                  {avatarMode === 'picture' && profileImageDraft ? (
                    <img src={profileImageDraft} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span>{selectedAvatar}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-[800] text-white">Preview</div>
                  <div className="mt-1 text-[13px] leading-6 text-slate-300">
                    Choose a built-in avatar or upload a profile picture, then save when you are happy with the preview.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAvatarMode('avatar');
                  setSettingsFeedback(null);
                }}
                className={avatarMode === 'avatar'
                  ? 'rounded-[1.25rem] border border-[var(--lime)] bg-[rgba(184,250,51,0.14)] px-4 py-3 text-left text-white'
                  : 'rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left text-slate-200'}
              >
                <div className="flex items-center gap-2 text-[14px] font-[800]"><Sparkles className="h-4 w-4" /> Built-in avatar</div>
                <div className="mt-1 text-[12px] text-slate-300">Choose from the avatar pack already in the app.</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvatarMode('picture');
                  setSettingsFeedback(null);
                }}
                className={avatarMode === 'picture'
                  ? 'rounded-[1.25rem] border border-[var(--lime)] bg-[rgba(184,250,51,0.14)] px-4 py-3 text-left text-white'
                  : 'rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left text-slate-200'}
              >
                <div className="flex items-center gap-2 text-[14px] font-[800]"><ImagePlus className="h-4 w-4" /> Profile picture</div>
                <div className="mt-1 text-[12px] text-slate-300">Upload a picture and preview it before saving.</div>
              </button>
            </div>

            {avatarMode === 'avatar' ? (
              <div className="grid grid-cols-4 gap-3">
                {PROFILE_AVATARS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setSelectedAvatar(entry)}
                    className={entry === selectedAvatar
                      ? 'grid h-20 place-items-center rounded-[1.4rem] border border-[var(--lime)] bg-[rgba(184,250,51,0.14)] text-[34px]'
                      : 'grid h-20 place-items-center rounded-[1.4rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[32px]'}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-[var(--surface-2)] text-[30px]">
                    {profileImageDraft ? (
                      <img src={profileImageDraft} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus className="h-4 w-4" />
                      Choose picture
                    </Button>
                    <div className="text-[12px] text-slate-300">Use a smaller image so the mobile app stays light and fast.</div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickProfileImage} />
              </div>
            )}

            <Field label="Display name" value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} placeholder="Player name" />
            <Field label="Country" value={editCountry} onChange={(event) => setEditCountry(event.target.value)} placeholder="Nigeria" />
            <Field label="Registered email" value={profile.user.email} readOnly className="opacity-80" />
            <Field label="Registered phone number" value={profile.user.phone} readOnly className="opacity-80" />
            <Field label="Birthday" value={formatAccountDate(profile.user.dateOfBirth)} readOnly className="opacity-80" />

            <div className="rounded-[1.25rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[13px] leading-6 text-slate-200">
              Your birthday was verified during account creation and cannot be changed.
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  resetProfileDrafts();
                  closePanel();
                }}
                disabled={editBusy}
              >
                Cancel
              </Button>
              <Button fullWidth onClick={() => { void saveProfileChanges(); }} disabled={editBusy}>
                {editBusy ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : null}

        {activePanel === 'facts' ? (
          <div className="space-y-5 text-white">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoTile icon={IdCard} label="Player ID" value={profile.user.id} />
              <InfoTile icon={CalendarDays} label="Account created" value={formatJoinDate(profile.user.joinedAt)} />
              <InfoTile icon={ShieldCheck} label="Verification status" value={getVerificationLabel(profile.user)} />
              <InfoTile icon={Crown} label="Fair-play status" value={getFairPlayLabel(profile)} />
              <InfoTile icon={Trophy} label="Games played" value={String(profile.totals.matchesPlayed)} />
              <InfoTile icon={Sparkles} label="Wins and losses" value={`${profile.totals.wins} wins • ${profile.totals.losses} losses`} />
              <InfoTile icon={Sword} label="Current rating" value={`${profile.user.rating} rating`} />
              <InfoTile icon={Mail} label="Legal name" value={legalName} />
            </div>

            <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="text-[15px] font-[800] text-white">Quick facts</div>
              <div className="mt-3 space-y-3 text-[13px] text-slate-200">
                <FactRow label="Username" value={`@${profile.user.username}`} />
                <FactRow label="Tier" value={profile.user.tier} />
                <FactRow label="Referral code" value={profile.referral.code} />
                <FactRow label="Wallet balance" value={money(profile.balance)} />
              </div>
            </div>
          </div>
        ) : null}

        {activePanel === 'referrals' ? (
          <div className="space-y-5 text-white">
            <div className="rounded-[1.45rem] bg-[linear-gradient(135deg,#3458f6_0%,#6f4df7_100%)] p-5 text-white">
              <div className="text-[11px] font-[800] uppercase tracking-[0.18em] text-white/72">Referral code</div>
              <div className="mt-2 text-[1.9rem] font-[900] tracking-[0.18em]">{profile.referral.code}</div>
              <div className="mt-2 text-[13px] leading-6 text-white/82">
                Earn {money(profile.referral.rewardPerFriend)} and {profile.referral.pointsPerFriend} points for every successful signup using your code.
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="secondary" fullWidth onClick={copyReferralCode} className="border-white/20 bg-white text-slate-900 hover:bg-slate-100">
                  <Copy className="h-4 w-4" />
                  Copy code
                </Button>
                <Button fullWidth onClick={shareReferralCode} className="border-white/20 bg-black/30 text-white shadow-none hover:bg-black/40">
                  <Share2 className="h-4 w-4" />
                  Share referral link
                </Button>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="text-[15px] font-[800] text-white">Reward summary</div>
              <div className="mt-3 space-y-3 text-[13px] text-slate-200">
                <FactRow label="Successful referrals" value={String(profile.referral.friends.length)} />
                <FactRow label="Referral cash earned" value={money(profile.totals.referralEarnings)} />
                <FactRow label="Referral points earned" value={String(profile.totals.referralPoints)} />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="text-[15px] font-[800] text-white">Referral history</div>
              <div className="mt-4 space-y-3">
                {profile.referral.friends.length ? profile.referral.friends.map((friend) => (
                  <div key={friend.id} className="rounded-[1.2rem] bg-white/6 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-[800] text-white">{friend.displayName}</div>
                        <div className="mt-1 text-[12px] text-slate-300">@{friend.username} • joined {timeAgo(friend.joinedAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-[850] text-emerald-300">{money(friend.rewardAmount)}</div>
                        <div className="text-[11px] text-amber-200">+{friend.rewardPoints} pts</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[1.2rem] bg-white/6 px-4 py-4 text-[13px] leading-6 text-slate-300">
                    No referrals yet. Share your code to start earning referral cash and bonus points.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activePanel === 'matches' ? (
          <div className="space-y-5 text-white">
            <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[13px] leading-6 text-slate-200">
              Every settled match appears here with the game, opponent, date, score, stake, and payout.
            </div>

            <div className="space-y-3">
              {profile.matches.length ? profile.matches.map((match) => (
                <div key={match.id} className="rounded-[1.35rem] bg-white/6 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[15px] font-[850] text-white">{match.game} vs {match.opponent.name}</div>
                      <div className="mt-1 text-[12px] text-slate-300">{new Date(match.at).toLocaleString(PRIMARY_LOCALE, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                    <div className={match.result === 'win' ? 'rounded-full bg-emerald-500/18 px-3 py-1 text-[11px] font-[800] uppercase tracking-[0.16em] text-emerald-200' : match.result === 'draw' ? 'rounded-full bg-amber-500/18 px-3 py-1 text-[11px] font-[800] uppercase tracking-[0.16em] text-amber-200' : 'rounded-full bg-white/10 px-3 py-1 text-[11px] font-[800] uppercase tracking-[0.16em] text-white'}>
                      {match.result}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] text-slate-200">
                    <FactRow label="Score" value={match.score} />
                    <FactRow label="Stake" value={money(match.stake)} />
                    <FactRow label="Payout" value={money(match.payout)} />
                    <FactRow label="Opponent" value={match.opponent.name} />
                  </div>
                </div>
              )) : (
                <div className="rounded-[1.35rem] bg-white/6 px-4 py-4 text-[13px] leading-6 text-slate-300">
                  No settled matches yet. Once you play, your win-loss record and payouts will appear here.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activePanel === 'share' ? (
          <div className="space-y-5 text-white">
            <div className="rounded-[1.45rem] bg-[linear-gradient(135deg,#111827_0%,#1d2753_100%)] p-5">
              <div className="text-[11px] font-[800] uppercase tracking-[0.18em] text-slate-300">Public profile link</div>
              <div className="mt-3 break-all rounded-[1rem] bg-white/8 px-4 py-3 text-[13px] leading-6 text-white">
                {profileShareUrl}
              </div>
              <div className="mt-3 text-[13px] leading-6 text-slate-300">
                Share your player identity with friends or copy the link and drop it into chat, email, or WhatsApp.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button fullWidth onClick={copyProfileLink}>
                <Copy className="h-4 w-4" />
                Copy profile link
              </Button>
              <Button variant="secondary" fullWidth onClick={shareProfile}>
                <Share2 className="h-4 w-4" />
                Share profile
              </Button>
            </div>

            <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="text-[15px] font-[800] text-white">What people will see</div>
              <div className="mt-4 flex items-center gap-4 rounded-[1.2rem] bg-white/6 px-4 py-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#0f172a] text-[28px] text-white">
                  {profileVisual ? (
                    <img src={profileVisual} alt={profile.user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{profile.user.avatar || getDisplayInitial(profile.user)}</span>
                  )}
                </div>
                <div>
                  <div className="text-[16px] font-[850] text-white">{profile.user.displayName}</div>
                  <div className="mt-1 text-[13px] text-slate-300">@{profile.user.username}</div>
                  <div className="mt-1 text-[12px] text-slate-400">{profile.user.rating} rating • {profile.user.tier}</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </ProfilePanel>

      <Modal open={signOutOpen} onClose={() => setSignOutOpen(false)} title="Sign out" maxWidth="max-w-md">
        <div className="space-y-5 text-white">
          <div className="rounded-[1.35rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[14px] leading-6 text-slate-200">
            Are you sure you want to sign out?
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={() => setSignOutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setSignOutOpen(false);
                onLogout();
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProfilePanel({
  open,
  title,
  onBack,
  children,
}: {
  open: boolean;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBack, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-[#050912]/82 backdrop-blur-sm" onClick={onBack} />
      <div className="relative flex min-h-full items-start justify-center px-4 pt-[max(18px,env(safe-area-inset-top))] pb-[max(88px,calc(env(safe-area-inset-bottom)+88px))]">
        <div className="w-full max-w-[32rem] overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[var(--bg-soft)] text-[var(--text)] shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-5 py-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-2 text-[13px] font-[800] text-white transition hover:bg-[var(--surface-3)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="text-[20px] font-[800] tracking-[-0.03em] text-white">{title}</div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-[13px] font-[800] text-slate-200 transition hover:text-white"
              aria-label={`Close ${title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(100dvh-100px)] overflow-y-auto px-5 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] bg-white/6 px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] font-[800] uppercase tracking-[0.14em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-[15px] font-[760] leading-6 text-white">{value}</div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-white/6 px-3 py-3">
      <div className="text-[12px] font-[700] uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="text-right text-[13px] font-[760] text-white">{value}</div>
    </div>
  );
}
