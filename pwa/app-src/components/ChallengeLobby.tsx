import React from 'react';
import { GAME_META, mockChallenges, mockOnlinePlayers } from '../lib/mock';
import { GAME_RULES, inviteCodePrefix } from '../lib/gameRules';
import { PRIMARY_CURRENCY_LABEL } from '../lib/market';
import { realtimeClient } from '../lib/realtime';
import { cn, money, timeAgo } from '../lib/utils';
import { Badge, Button, Card, Field, GlassCard, Modal, Pill } from './ui';
import type { Challenge, ChallengeInviteTarget, GameId, LudoSeats, User } from '../lib/types';
import { betaApi, type BetaUserSummary } from '../lib/api';
import { Globe, Mail, Plus, Sparkles, Swords, Users } from 'lucide-react';

type ChallengeDraft = {
  game: GameId;
  stake: number;
  split: 'winner_takes_all' | '70_30';
  mode?: 'solo' | 'friends';
  seats?: LudoSeats;
  inviteScope?: 'public' | 'private';
  invitedUsers?: ChallengeInviteTarget[];
  invitedEmails?: string[];
  inviteCode?: string;
};

type ChallengeComposerIntent = {
  game?: GameId;
  inviteScope?: 'public' | 'private';
  stake?: number;
  friendId?: string;
};

type ChallengeSelectableUser = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  rating: number;
  online?: boolean;
};

function upsertChallenge(list: Challenge[], next: Challenge) {
  const existing = list.findIndex((challenge) => challenge.id === next.id);
  if (existing === -1) return [next, ...list];
  return list.map((challenge) => challenge.id === next.id ? next : challenge);
}

function mockVisibleChallenges(user: User) {
  return mockChallenges.filter((challenge) => isVisibleChallenge(challenge, user));
}

function invitedUsersFor(challenge: Challenge) {
  if (challenge.invitedUsers?.length) return challenge.invitedUsers;
  if (challenge.invitedUserId || challenge.invitedUserName) {
    return [{
      id: challenge.invitedUserId,
      name: challenge.invitedUserName || 'Friend',
    }];
  }
  return [];
}

function invitedEmailsFor(challenge: Challenge) {
  return challenge.invitedEmails ?? [];
}

function isVisibleChallenge(challenge: Challenge, user: User) {
  if (challenge.inviteScope !== 'private') return true;
  const invitedIds = invitedUsersFor(challenge).map((invite) => invite.id).filter(Boolean);
  return challenge.creator.id === user.id || invitedIds.includes(user.id) || challenge.participants?.some((participant) => participant.id === user.id);
}

function directInviteCount(challenge: Challenge) {
  return invitedUsersFor(challenge).length + invitedEmailsFor(challenge).length;
}

function shareSummary(challenge: Challenge) {
  const invitedUsers = invitedUsersFor(challenge);
  const invitedEmails = invitedEmailsFor(challenge);
  const scopeLabel = challenge.inviteScope === 'private' ? 'Private challenge' : 'Public challenge';
  const inviteTargets = [
    ...invitedUsers.map((invite) => invite.name),
    ...invitedEmails,
  ];
  return [
    `${GAME_META[challenge.game].name} • ${scopeLabel}`,
    `Stake: ${money(challenge.stake)}`,
    challenge.inviteCode ? `Invite code: ${challenge.inviteCode}` : null,
    inviteTargets.length ? `Invited: ${inviteTargets.join(', ')}` : null,
  ].filter(Boolean).join('\n');
}

async function copyShareSummary(challenge: Challenge, toast: (message: string) => void) {
  const payload = shareSummary(challenge);
  try {
    if (navigator?.share) {
      await navigator.share({
        title: `${GAME_META[challenge.game].name} challenge`,
        text: payload,
      });
      toast(challenge.inviteCode ? `Challenge shared • ${challenge.inviteCode}` : 'Challenge shared.');
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      toast(challenge.inviteCode ? `Invite details copied • ${challenge.inviteCode}` : 'Challenge details copied.');
      return;
    }
  } catch {}
  toast(challenge.inviteCode ? `Invite ready • ${challenge.inviteCode}` : 'Challenge details are ready to share.');
}

const LOBBY_GAME_STYLE: Record<GameId, {
  cardBorder: string;
  wash: string;
  icon: string;
  stat: string;
}> = {
  words: {
    cardBorder: 'border-amber-300/16',
    wash: 'from-amber-400/18 via-orange-400/10 to-transparent',
    icon: 'from-amber-400 to-orange-500',
    stat: 'text-amber-200',
  },
  scrabble: {
    cardBorder: 'border-sky-300/16',
    wash: 'from-sky-400/18 via-indigo-400/10 to-transparent',
    icon: 'from-sky-400 to-indigo-500',
    stat: 'text-sky-200',
  },
  chess: {
    cardBorder: 'border-slate-300/16',
    wash: 'from-slate-300/16 via-zinc-400/10 to-transparent',
    icon: 'from-slate-400 to-zinc-600',
    stat: 'text-slate-200',
  },
  ludo: {
    cardBorder: 'border-lime-300/16',
    wash: 'from-lime-400/18 via-emerald-400/10 to-transparent',
    icon: 'from-lime-400 to-emerald-500',
    stat: 'text-lime-200',
  },
  whot: {
    cardBorder: 'border-emerald-300/16',
    wash: 'from-emerald-400/18 via-teal-400/10 to-transparent',
    icon: 'from-emerald-400 to-teal-500',
    stat: 'text-emerald-200',
  },
};

function isChallengeDirectedToUser(challenge: Challenge, userId: string) {
  if (challenge.creator.id === userId) return false;
  const invitedIds = invitedUsersFor(challenge).map((invite) => invite.id).filter(Boolean);
  return invitedIds.includes(userId) || !!challenge.participants?.some((participant) => participant.id === userId);
}

function LobbyStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/[0.08] text-slate-300">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-[24px] font-[820] tracking-[-0.04em]">{value}</div>
    </div>
  );
}

function LobbySection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <div className="text-[18px] font-[800] tracking-[-0.03em] text-white">{title}</div>
        <div className="text-[12px] text-slate-300">{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

function ChallengeCard({
  challenge,
  user,
  busy,
  actionsDisabled,
  disabledActionLabel,
  onAccept,
  onWatch,
  onOpenRoom,
  toast,
}: {
  challenge: Challenge;
  user: User;
  busy: boolean;
  actionsDisabled: boolean;
  disabledActionLabel: string;
  onAccept: (challenge: Challenge) => void;
  onWatch: (challenge: Challenge) => void;
  onOpenRoom: (challenge: Challenge) => void;
  toast: (message: string) => void;
}) {
  const meta = GAME_META[challenge.game];
  const style = LOBBY_GAME_STYLE[challenge.game];
  const isMine = challenge.creator.id === user.id;
  const invitedUsers = invitedUsersFor(challenge);
  const invitedEmails = invitedEmailsFor(challenge);
  const inviteCount = invitedUsers.length + invitedEmails.length;
  const isDirectInvite = isChallengeDirectedToUser(challenge, user.id);
  const requiresAcceptedOpponent = challenge.game === 'words' || challenge.game === 'scrabble';
  const acceptedOpponentCount = challenge.participants?.filter((participant) => participant.id !== challenge.creator.id).length ?? 0;
  const hasAcceptedOpponent = isMine ? acceptedOpponentCount > 0 : true;
  const canOpenCreatorRoom = !requiresAcceptedOpponent || hasAcceptedOpponent;
  const isParticipant = challenge.creator.id === user.id || !!challenge.participants?.some((participant) => participant.id === user.id);
  const canWatchLive = challenge.game === 'ludo' && challenge.status === 'in_progress' && !isParticipant;
  const seatsTotal = challenge.game === 'ludo' ? challenge.seats || 2 : 2;
  const seatsFilled = challenge.seatsFilled || challenge.participants?.length || 1;
  const tableLabel = challenge.game === 'ludo'
    ? `${seatsTotal}-player table`
    : challenge.game === 'scrabble'
      ? '2-player word board'
      : challenge.game === 'words'
        ? 'Rack duel room'
        : '1v1 table';
  const scopeLabel = challenge.inviteScope === 'private' ? 'Invite only' : 'Public listing';
  const inviteDetail = inviteCount
    ? `${invitedUsers.length} friend invite${invitedUsers.length === 1 ? '' : 's'}${invitedEmails.length ? ` • ${invitedEmails.length} email referral${invitedEmails.length === 1 ? '' : 's'}` : ''}`
    : 'Open to anyone in the lobby';

  return (
    <GlassCard className={cn('relative overflow-hidden p-5', style.cardBorder)}>
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', style.wash)} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('grid h-12 w-12 place-items-center rounded-[18px] bg-gradient-to-br text-2xl text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]', style.icon)}>
              <span>{meta.emoji}</span>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{tableLabel}</div>
              <div className="text-[18px] font-[780] tracking-[-0.03em] text-white">{meta.name}</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {isMine && <Badge variant="emerald">Your room</Badge>}
            {isDirectInvite && <Badge variant="gold">Direct invite</Badge>}
            <Badge variant="default">{scopeLabel}</Badge>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-[24px]">
            {challenge.creator.avatar}
          </div>
          <div className="min-w-0">
            <div className="truncate font-[680] text-white">{challenge.creator.name} • {challenge.creator.rating}</div>
            <div className="text-[12.6px] text-slate-400">Posted {timeAgo(challenge.createdAt)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-[12.8px] text-slate-200 sm:grid-cols-2">
          <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Format</div>
            <div className="mt-1 font-[700] text-white">{challenge.game === 'ludo' ? `${seatsFilled}/${seatsTotal} seats filled` : tableLabel}</div>
            <div className="mt-1 text-slate-400">
              {challenge.game === 'ludo'
                ? 'Visible board with wallet-backed seats'
                : challenge.game === 'scrabble'
                  ? 'Shared board with hidden racks'
                  : challenge.game === 'words'
                    ? 'Human-only word duel'
                    : 'Fast skill duel'}
            </div>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Access</div>
            <div className="mt-1 font-[700] text-white">{challenge.inviteCode || scopeLabel}</div>
            <div className="mt-1 text-slate-400">{inviteDetail}</div>
          </div>
        </div>

        {!!challenge.participants?.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {challenge.participants.map((participant) => (
              <span key={participant.id} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12.4px] text-slate-200">
                {participant.avatar} {participant.name}
              </span>
            ))}
          </div>
        )}

        {!!inviteCount && (
          <div className="mt-4 flex flex-wrap gap-2">
            {invitedUsers.map((invite, index) => (
              <span key={`${invite.id || invite.name}-${index}`} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12.4px] text-slate-200">
                {invite.avatar || '🤝'} {invite.name}
              </span>
            ))}
            {invitedEmails.map((email) => (
              <span key={email} className="rounded-full border border-white/10 bg-sky-400/[0.12] px-3 py-1.5 text-[12.4px] text-sky-100">
                ✉ {email}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11.5px] uppercase tracking-[0.16em] text-slate-400">Stake per seat</div>
            <div className={cn('text-[25px] font-[840] tracking-[-0.04em]', style.stat)}>{money(challenge.stake)}</div>
            <div className="text-[12px] text-slate-400">{challenge.split === 'winner_takes_all' ? 'Winner takes all' : '70 / 30 split'}</div>
          </div>
          {isMine ? (
            <div className="flex items-center gap-2">
              <Button disabled={actionsDisabled || !canOpenCreatorRoom} onClick={() => onOpenRoom(challenge)}>
                {actionsDisabled
                  ? disabledActionLabel
                  : !canOpenCreatorRoom
                    ? 'Waiting for player'
                    : challenge.game === 'scrabble'
                      ? 'Open board'
                      : 'Open room'}
              </Button>
              <Button variant="secondary" onClick={() => copyShareSummary(challenge, toast)}>
                Share
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {canWatchLive ? (
                <Button variant="secondary" disabled={actionsDisabled} onClick={() => onWatch(challenge)}>
                  {actionsDisabled ? disabledActionLabel : 'Watch live'}
                </Button>
              ) : (
                <Button
                  disabled={busy || actionsDisabled}
                  onClick={() => onAccept(challenge)}
                >
                  {busy ? 'Joining…' : actionsDisabled ? disabledActionLabel : 'Accept & play'}
                </Button>
              )}
            </div>
          )}
        </div>
        {isMine && !canOpenCreatorRoom && (
          <div className="mt-3 text-[12.4px] text-slate-400">
            This {challenge.game === 'scrabble' ? 'board' : 'room'} will open once one real opponent accepts the challenge.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export function ChallengeLobby({
  user,
  onAccept,
  onWatch,
  onBack,
  toast,
  launchIntent,
  onLaunchIntentHandled,
}: {
  user: User;
  onAccept:(c:Challenge)=>void;
  onWatch:(c:Challenge)=>void;
  onBack?: ()=>void;
  toast:(m:string)=>void;
  launchIntent?: ChallengeComposerIntent | null;
  onLaunchIntentHandled?: () => void;
}) {
  const [openCreate, setOpenCreate] = React.useState(false);
  const [createSeed, setCreateSeed] = React.useState<ChallengeComposerIntent | null>(null);
  const [challenges, setChallenges] = React.useState<Challenge[]>(() => mockVisibleChallenges(user));
  const [connectionState, setConnectionState] = React.useState<'local'|'connecting'|'online'>('local');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const toastEvent = React.useEffectEvent((message: string) => toast(message));

  React.useEffect(() => {
    if (!launchIntent) return;
    setCreateSeed(launchIntent);
    setOpenCreate(true);
    onLaunchIntentHandled?.();
  }, [launchIntent, onLaunchIntentHandled]);

  React.useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];

    async function connect() {
      if (!realtimeClient.isConfigured) {
        setConnectionState('local');
        setChallenges(mockVisibleChallenges(user));
        return;
      }

      setChallenges(mockVisibleChallenges(user));
      setConnectionState('connecting');

      while (!disposed) {
        const connected = await realtimeClient.connect(user).catch(() => false);
        if (disposed) return;

        if (connected) {
          setConnectionState('online');

          const liveChallenges = await realtimeClient.listChallenges().catch(() => null);
          if (!disposed) {
            setChallenges(liveChallenges?.filter((challenge) => isVisibleChallenge(challenge, user)) ?? []);
          }

          cleanups.push(
            realtimeClient.onChallenge('challenge:upsert', (challenge) => {
              if (!isVisibleChallenge(challenge, user)) return;
              setChallenges((current) => upsertChallenge(current, challenge));
            }),
          );

          cleanups.push(
            realtimeClient.onChallenge('invite:received', (challenge) => {
              if (!isVisibleChallenge(challenge, user)) return;
              setChallenges((current) => upsertChallenge(current, challenge));
              toastEvent(`${challenge.creator.name} invited you to a ${GAME_META[challenge.game].short} table.`);
            }),
          );

          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
    }

    connect();

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [toastEvent, user]);

  const visibleChallenges = React.useMemo(
    () => [...challenges.filter((challenge) => isVisibleChallenge(challenge, user))].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [challenges, user],
  );
  const liveConfigured = realtimeClient.isConfigured;
  const livePreviewMode = liveConfigured && connectionState !== 'online';
  const liveActionsBlocked = false;
  const liveActionLabel = livePreviewMode ? 'Preview mode' : 'Live';
  const liveBlockedMessage = connectionState === 'connecting'
    ? 'Live sync is waking up. Preview mode is available while the server reconnects.'
    : 'Live sync is unavailable right now. Preview mode is available until the server responds.';
  const liveStatusMessage = connectionState === 'connecting'
    ? 'Live sync is waking up. You can still explore the lobby and open preview tables while the shared server reconnects.'
    : 'Live sync is unavailable right now. You can keep using preview mode, and shared rooms will appear once the server responds.';

  const myChallenges = React.useMemo(
    () => visibleChallenges.filter((challenge) => challenge.creator.id === user.id),
    [visibleChallenges, user.id],
  );

  const invitedChallenges = React.useMemo(
    () => visibleChallenges.filter((challenge) => isChallengeDirectedToUser(challenge, user.id)),
    [visibleChallenges, user.id],
  );

  const publicChallenges = React.useMemo(() => {
    const inviteIds = new Set(invitedChallenges.map((challenge) => challenge.id));
    return visibleChallenges.filter((challenge) => challenge.creator.id !== user.id && challenge.inviteScope !== 'private' && !inviteIds.has(challenge.id));
  }, [invitedChallenges, user.id, visibleChallenges]);

  const launchComposer = React.useCallback((intent?: ChallengeComposerIntent | null) => {
    setCreateSeed(intent ?? null);
    setOpenCreate(true);
  }, []);

  const handleAccept = React.useCallback(async (challenge: Challenge) => {
    try {
      setBusyId(challenge.id);
      if (connectionState === 'online') {
        const accepted = await realtimeClient.acceptChallenge(challenge.id, user);
        if (accepted?.challenge) {
          onAccept(accepted.challenge);
          toast(`${GAME_META[challenge.game].short} room secured — opening table…`);
          return;
        }
      }
      onAccept(challenge);
      toast(livePreviewMode ? 'Live sync is warming up — opening a preview table for now…' : 'Challenge accepted — table opening…');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not accept challenge.');
    } finally {
      setBusyId(null);
    }
  }, [connectionState, livePreviewMode, onAccept, toast, user]);

  const handleOpenRoom = React.useCallback((challenge: Challenge) => {
    onAccept(challenge);
    toast(livePreviewMode ? `Opening your ${GAME_META[challenge.game].short} preview room while live sync reconnects…` : `Opening your ${GAME_META[challenge.game].short} room…`);
  }, [livePreviewMode, onAccept, toast]);

  const handleWatch = React.useCallback((challenge: Challenge) => {
    onWatch(challenge);
    toast(`Joining ${GAME_META[challenge.game].short} as a spectator…`);
  }, [onWatch, toast]);

  const handleCreate = React.useCallback(async (draft: ChallengeDraft, options?: { shareAfterCreate?: boolean }) => {
    const invitedUsers = draft.invitedUsers?.filter((invite) => invite.id || invite.name) ?? [];
    const invitedEmails = draft.invitedEmails?.map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
    const primaryInvite = invitedUsers[0];
    const challengePayload: Challenge = {
      id: `cx${Math.random().toString(36).slice(2, 9)}`,
      game: draft.game,
      stake: draft.stake,
      split: draft.split,
      mode: draft.mode,
      seats: draft.seats,
      creator: {
        id: user.id,
        name: user.displayName,
        avatar: user.avatar,
        rating: user.rating,
      },
      createdAt: new Date().toISOString(),
      status: 'open',
      inviteScope: draft.inviteScope,
      invitedUserId: primaryInvite?.id,
      invitedUserName: primaryInvite?.name,
      invitedUsers: invitedUsers.length ? invitedUsers : undefined,
      invitedEmails: invitedEmails.length ? invitedEmails : undefined,
      inviteCode: draft.inviteCode,
    };

    if (connectionState === 'online') {
      const created = await realtimeClient.createChallenge(challengePayload);
      if (created) setChallenges((current) => upsertChallenge(current, created));
      const directInvites = created ? directInviteCount(created) : invitedUsers.length + invitedEmails.length;
      toast(
        directInvites
          ? `Challenge posted with ${directInvites} saved invite${directInvites === 1 ? '' : 's'}${created?.inviteCode ? ` • ${created.inviteCode}` : ''}`
          : 'Challenge posted. Waiting for opponent…',
      );
      if (options?.shareAfterCreate && created) {
        await copyShareSummary(created, toast);
      }
      if (created?.game === 'ludo') {
        onAccept(created);
      }
      return true;
    }

    setChallenges((current) => upsertChallenge(current, challengePayload));
    const directInvites = invitedUsers.length + invitedEmails.length;
    toast(
      directInvites
        ? `${livePreviewMode ? 'Preview challenge posted' : 'Challenge posted'} with ${directInvites} saved invite${directInvites === 1 ? '' : 's'}${draft.inviteCode ? ` • ${draft.inviteCode}` : ''}`
        : livePreviewMode
          ? 'Preview challenge posted. Waiting for opponent…'
          : 'Challenge posted. Waiting for opponent…',
    );
    if (options?.shareAfterCreate) {
      await copyShareSummary(challengePayload, toast);
    }
    return true;
  }, [connectionState, livePreviewMode, onAccept, toast, user]);

  return (
    <div className="space-y-6 text-white">
      <GlassCard className="relative overflow-hidden border-indigo-400/[0.16] bg-gradient-to-br from-[#111a30]/96 via-[#0e1528]/94 to-[#0a1020]/96 p-5">
        <div className="pointer-events-none absolute right-[-3rem] top-[-3rem] h-32 w-32 rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Play lobby</div>
              <h2 className="mt-2 text-[34px] font-[800] tracking-[-0.06em] text-white">
                Clear rooms. Clear stakes. Clear next steps.
              </h2>
              <div className="mt-3 max-w-[22rem] text-[13.5px] leading-6 text-slate-300">
                Post public tables, send direct invites, and see exactly which rooms are yours, which ones need your response, and which ones are open in the lobby.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onBack && <Button variant="secondary" onClick={onBack}>Back to arena</Button>}
              <Button disabled={liveActionsBlocked} onClick={() => launchComposer(null)}>
                <Plus className="h-4 w-4" />
                Create challenge
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {liveConfigured ? (
              connectionState === 'online'
                ? <Badge variant="emerald">Live server</Badge>
                : connectionState === 'connecting'
                  ? <Badge variant="gold">Connecting…</Badge>
                  : <Badge variant="rose">Live server unavailable</Badge>
            ) : (
              <Badge variant="default">Local preview</Badge>
            )}
            <Badge variant="purple">{mockOnlinePlayers.length} players online</Badge>
          </div>
          {livePreviewMode && (
            <div className={cn(
              'mt-3 rounded-[18px] px-4 py-3 text-[12.8px] leading-6',
              connectionState === 'connecting'
                ? 'border border-amber-300/20 bg-amber-300/[0.12] text-amber-100'
                : connectionState === 'local'
                  ? 'border border-rose-300/20 bg-rose-300/[0.12] text-rose-100'
                  : 'border border-sky-300/20 bg-sky-400/[0.12] text-sky-100',
            )}>
              {liveStatusMessage}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LobbyStat label="Open rooms" value={String(visibleChallenges.length)} icon={<Swords className="h-4 w-4" />} />
            <LobbyStat label="Your rooms" value={String(myChallenges.length)} icon={<Sparkles className="h-4 w-4" />} />
            <LobbyStat label="Direct invites" value={String(invitedChallenges.length)} icon={<Mail className="h-4 w-4" />} />
            <LobbyStat label="Public tables" value={String(publicChallenges.length)} icon={<Globe className="h-4 w-4" />} />
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={liveActionsBlocked}
              onClick={() => launchComposer({ game: 'chess', inviteScope: 'public', stake: 10000 })}
              className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Quick action</div>
              <div className="mt-1 font-[760] text-white">Post public chess</div>
              <div className="mt-1 text-[12px] text-slate-400">Open a live table anyone can join.</div>
            </button>
            <button
              type="button"
              disabled={liveActionsBlocked}
              onClick={() => launchComposer({ game: 'words', inviteScope: 'private', stake: 5000 })}
              className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Quick action</div>
              <div className="mt-1 font-[760] text-white">Invite a friend</div>
              <div className="mt-1 text-[12px] text-slate-400">Launch a private WordForge or Scrabble room fast.</div>
            </button>
            <button
              type="button"
              disabled={liveActionsBlocked}
              onClick={() => launchComposer({ game: 'ludo', inviteScope: 'public', stake: 4000 })}
              className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Quick action</div>
              <div className="mt-1 font-[760] text-white">Open Ludo room</div>
              <div className="mt-1 text-[12px] text-slate-400">Spin up a visible 2- or 4-seat table.</div>
            </button>
          </div>
        </div>
      </GlassCard>

      {!!myChallenges.length && (
        <LobbySection title="Your rooms" subtitle="Rooms you posted and can open or share right now.">
          <div className="grid gap-4 md:grid-cols-2">
            {myChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                user={user}
                busy={busyId === challenge.id}
                actionsDisabled={liveActionsBlocked}
                disabledActionLabel={liveActionLabel}
                onAccept={handleAccept}
                onWatch={handleWatch}
                onOpenRoom={handleOpenRoom}
                toast={toast}
              />
            ))}
          </div>
        </LobbySection>
      )}

      {!!invitedChallenges.length && (
        <LobbySection title="Invites for you" subtitle="Private rooms and direct challenge requests that need your decision.">
          <div className="grid gap-4 md:grid-cols-2">
            {invitedChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                user={user}
                busy={busyId === challenge.id}
                actionsDisabled={liveActionsBlocked}
                disabledActionLabel={liveActionLabel}
                onAccept={handleAccept}
                onWatch={handleWatch}
                onOpenRoom={handleOpenRoom}
                toast={toast}
              />
            ))}
          </div>
        </LobbySection>
      )}

      <LobbySection title="Open lobby" subtitle="Public rooms anyone can join from the Play page.">
        {publicChallenges.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {publicChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                user={user}
                busy={busyId === challenge.id}
                actionsDisabled={liveActionsBlocked}
                disabledActionLabel={liveActionLabel}
                onAccept={handleAccept}
                onWatch={handleWatch}
                onOpenRoom={handleOpenRoom}
                toast={toast}
              />
            ))}
          </div>
        ) : (
          <GlassCard className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-white/[0.08]">
                <Users className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <div className="font-[760] text-white">No public rooms are live right now.</div>
                <div className="mt-1 text-[13px] leading-6 text-slate-400">Post the first table and it will appear here for everyone in the lobby.</div>
                <div className="mt-4">
                  <Button disabled={liveActionsBlocked} onClick={() => launchComposer({ inviteScope: 'public' })}>Post a public room</Button>
                </div>
              </div>
            </div>
          </GlassCard>
        )}
      </LobbySection>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em] text-white">Online now</div>
            <div className="text-[12px] text-slate-300">Players currently available across the active games.</div>
          </div>
          <Badge variant="purple">{mockOnlinePlayers.length} live</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {mockOnlinePlayers.map((player) => (
            <span key={player.id} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12.7px] text-slate-200">
              {player.avatar} @{player.username} • {GAME_META[player.game].short} • {player.rating}
            </span>
          ))}
        </div>
      </GlassCard>

      <CreateChallengeModal
        user={user}
        open={openCreate}
        initialIntent={createSeed}
        onClose={() => {
          setOpenCreate(false);
          setCreateSeed(null);
        }}
        onCreate={async (draft, options) => {
          const created = await handleCreate(draft, options);
          if (!created) return false;
          setOpenCreate(false);
          setCreateSeed(null);
          return true;
        }}
        actionsDisabled={liveActionsBlocked}
        disabledMessage={liveBlockedMessage}
        toast={toast}
      />
    </div>
  );
}

function CreateChallengeModal({
  user,
  open,
  initialIntent,
  onClose,
  onCreate,
  actionsDisabled,
  disabledMessage,
  toast,
}: {
  user: User;
  open: boolean;
  initialIntent?: ChallengeComposerIntent | null;
  onClose: () => void;
  onCreate: (challenge: ChallengeDraft, options?: { shareAfterCreate?: boolean }) => Promise<boolean>;
  actionsDisabled: boolean;
  disabledMessage: string;
  toast: (message: string) => void;
}) {
  const [game, setGame] = React.useState<GameId>('chess');
  const [stake, setStake] = React.useState(10000);
  const [split, setSplit] = React.useState<'winner_takes_all'|'70_30'>('winner_takes_all');
  const [inviteScope, setInviteScope] = React.useState<'public'|'private'>('public');
  const [ludoSeats, setLudoSeats] = React.useState<LudoSeats>(2);
  const [selectedFriendIds, setSelectedFriendIds] = React.useState<string[]>([]);
  const [usernameQuery, setUsernameQuery] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteEmails, setInviteEmails] = React.useState<string[]>([]);
  const [inviteHint, setInviteHint] = React.useState('');
  const [liveUsers, setLiveUsers] = React.useState<BetaUserSummary[]>([]);

  const rule = GAME_RULES[game];
  React.useEffect(() => {
    if (!open || !betaApi.isConfigured) {
      setLiveUsers([]);
      return;
    }

    let cancelled = false;
    betaApi.listUsers(user.id)
      .then((users) => {
        if (!cancelled) setLiveUsers(users);
      })
      .catch(() => {
        if (!cancelled) setLiveUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user.id]);

  const friendPool = React.useMemo<ChallengeSelectableUser[]>(() => {
    const realUsers = liveUsers.map((candidate) => ({
      id: candidate.id,
      name: candidate.displayName,
      username: candidate.username,
      avatar: candidate.avatar,
      rating: candidate.rating,
      online: candidate.online,
    }));

    const fallbackPlayers = mockOnlinePlayers
      .filter((player) => player.id !== user.id && player.game === game)
      .map((player) => ({
        id: player.id,
        name: player.name,
        username: player.username,
        avatar: player.avatar,
        rating: player.rating,
        online: true,
      }));

    const merged = [...realUsers];
    const seenIds = new Set(realUsers.map((candidate) => candidate.id));
    const seenUsernames = new Set(realUsers.map((candidate) => candidate.username.toLowerCase()));

    fallbackPlayers.forEach((candidate) => {
      if (seenIds.has(candidate.id) || seenUsernames.has(candidate.username.toLowerCase())) return;
      merged.push(candidate);
    });

    return merged.sort((left, right) => Number(right.online) - Number(left.online) || left.username.localeCompare(right.username));
  }, [game, liveUsers, user.id]);

  const resetFromIntent = React.useCallback((intent?: ChallengeComposerIntent | null) => {
    const nextGame = intent?.game ?? 'chess';
    setGame(nextGame);
    setStake(intent?.stake ?? (nextGame === 'words' ? 5000 : 10000));
    setSplit('winner_takes_all');
    setInviteScope(intent?.inviteScope ?? (GAME_RULES[nextGame].supportsPublicLobby ? 'public' : 'private'));
    setLudoSeats(2);
    setSelectedFriendIds(intent?.friendId ? [intent.friendId] : []);
    setUsernameQuery('');
    setInviteEmail('');
    setInviteEmails([]);
    setInviteHint('');
  }, []);

  React.useEffect(() => {
    if (!open) return;
    resetFromIntent(initialIntent);
  }, [initialIntent, open, resetFromIntent]);

  React.useEffect(() => {
    if (rule.privateInviteOnly) {
      setInviteScope('private');
      setSplit('winner_takes_all');
      return;
    }
    if (!rule.supportsPublicLobby && inviteScope === 'public') {
      setInviteScope('private');
    }
  }, [inviteScope, rule.privateInviteOnly, rule.supportsPublicLobby]);

  React.useEffect(() => {
    setSelectedFriendIds((current) => current.filter((friendId) => friendPool.some((player) => player.id === friendId)));
  }, [friendPool]);

  const selectedFriends = friendPool.filter((player) => selectedFriendIds.includes(player.id));
  const normalizedUsernameQuery = usernameQuery.trim().replace(/^@+/, '').toLowerCase();
  const usernameMatches = React.useMemo(() => {
    if (!normalizedUsernameQuery) return friendPool.slice(0, 4);
    return friendPool
      .filter((player) => player.username.toLowerCase().includes(normalizedUsernameQuery) || player.name.toLowerCase().includes(normalizedUsernameQuery))
      .slice(0, 4);
  }, [friendPool, normalizedUsernameQuery]);
  const totalSeats = game === 'ludo' ? ludoSeats : 2;
  const totalPot = stake * totalSeats;
  const payout = split === 'winner_takes_all' ? totalPot * 0.93 : totalPot * 0.651;
  const directInviteCount = selectedFriends.length + inviteEmails.length;

  const toggleFriend = (playerId: string) => {
    setSelectedFriendIds((current) => current.includes(playerId) ? current.filter((entry) => entry !== playerId) : [...current, playerId]);
  };

  const addFriendByUsername = (candidate?: string) => {
    const normalized = (candidate ?? usernameQuery).trim().replace(/^@+/, '').toLowerCase();
    if (!normalized) {
      setInviteHint('Type a username first.');
      return;
    }
    const match = friendPool.find((player) => player.username.toLowerCase() === normalized);
    if (!match) {
      setInviteHint(`No ${GAME_META[game].short} player found for @${normalized}.`);
      return;
    }
    if (selectedFriendIds.includes(match.id)) {
      setInviteHint(`${match.name} is already on this challenge.`);
      setUsernameQuery('');
      return;
    }
    setSelectedFriendIds((current) => [...current, match.id]);
    setUsernameQuery('');
    setInviteHint(`${match.name} added with @${match.username}.`);
  };

  const addInviteEmail = () => {
    const normalized = inviteEmail.trim().toLowerCase();
    if (!normalized) {
      setInviteHint('Add an email address first.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalized)) {
      setInviteHint('Use a valid email address.');
      return;
    }
    if (inviteEmails.includes(normalized)) {
      setInviteHint('That email is already queued.');
      return;
    }
    setInviteEmails((current) => [...current, normalized]);
    setInviteEmail('');
    setInviteHint('Email referral invite added.');
  };

  const inviteCode = (inviteScope === 'private' || directInviteCount > 0)
    ? `${inviteCodePrefix(game)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`
    : undefined;

  const quickPlayLivesInLobby = game === 'words' || game === 'scrabble';
  const quickPlayNote = game === 'words'
    ? 'WordForge quick play currently runs as a heads-up challenge. Invite one or more usernames and the first accepted seat becomes your live opponent.'
    : 'Scrabble Social quick play currently opens as a heads-up board. You can still post it publicly, invite by username, and share the challenge link or code.';
  const optionChipClass = 'rounded-full border border-[rgba(255,255,255,0.08)] px-3.5 py-2 text-[13.5px] transition';
  const selectClass = 'w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-4 py-4 text-[15px] text-white outline-none transition focus:border-[rgba(184,250,51,0.4)] focus:ring-2 focus:ring-[rgba(184,250,51,0.16)] disabled:opacity-60';

  const submitChallenge = async (shareAfterCreate = false) => {
    if (actionsDisabled) {
      toast(disabledMessage);
      return;
    }

    await onCreate({
      game,
      stake,
      split,
      mode: 'friends',
      seats: game === 'ludo' ? ludoSeats : undefined,
      inviteScope,
      invitedUsers: selectedFriends.map((friend) => ({
        id: friend.id,
        name: friend.name,
        username: friend.username,
        avatar: friend.avatar,
        rating: friend.rating,
      })),
      invitedEmails: inviteEmails,
      inviteCode,
    }, { shareAfterCreate });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create challenge" maxWidth="max-w-2xl">
      <div className="space-y-5 text-white">
        <div className="rounded-[24px] border border-[rgba(122,84,239,0.18)] bg-[linear-gradient(145deg,rgba(122,84,239,0.18),rgba(16,22,34,0.96)_65%,rgba(10,15,24,0.98))] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Compose room</div>
              <div className="mt-1 text-[22px] font-[800] tracking-[-0.05em] text-white">
                Set the game, the stake, and who should see it.
              </div>
              <div className="mt-2 text-[13px] leading-6 text-slate-200">
                Public tables appear in the Play lobby. Private rooms can include multiple friends and saved email referrals.
              </div>
            </div>
            <Pill>{GAME_META[game].short}</Pill>
          </div>
        </div>

        {quickPlayLivesInLobby && (
          <div className="rounded-[20px] border border-sky-300/18 bg-sky-400/[0.12] px-4 py-4 text-[13px] text-sky-50">
            <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/80">Quick play setup</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill>2-player live table</Pill>
              <Pill>{inviteScope === 'public' ? 'Post in lobby' : 'Private invite room'}</Pill>
              <Pill>{money(stake)} stake</Pill>
            </div>
            <div className="mt-3 leading-6 text-sky-50/92">{quickPlayNote}</div>
          </div>
        )}

        {actionsDisabled && (
          <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/[0.12] px-4 py-3 text-[12.8px] text-amber-100">
            {disabledMessage}
          </div>
        )}

        <div>
          <div className="mb-2 text-[12.6px] font-[700] text-[var(--muted)]">Game</div>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(GAME_META) as GameId[]).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setGame(entry)}
                className={game === entry
                  ? `${optionChipClass} border-[rgba(184,250,51,0.24)] bg-[var(--lime)] text-[#0d1117]`
                  : `${optionChipClass} text-slate-100 hover:bg-white/[0.04]`}
              >
                {GAME_META[entry].emoji} {GAME_META[entry].short}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={game === 'ludo' ? `Stake per seat (${PRIMARY_CURRENCY_LABEL})` : `Stake (${PRIMARY_CURRENCY_LABEL})`} type="number" value={stake} onChange={(event)=>setStake(Math.max(0, parseFloat(event.target.value)||0))}/>
          <label className="block text-[12.8px]">
            <div className="mb-3 font-[700] text-[var(--muted)]">Payout</div>
            <select value={split} disabled={rule.privateInviteOnly} onChange={(event)=>setSplit(event.target.value as 'winner_takes_all'|'70_30')} className={selectClass}>
              <option value="winner_takes_all">Winner takes all</option>
              <option value="70_30">70 / 30 split</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {game === 'ludo' ? (
            <label className="block text-[12.8px]">
              <div className="mb-3 font-[700] text-[var(--muted)]">Seats</div>
              <select value={ludoSeats} onChange={(event)=>setLudoSeats(Number(event.target.value) as LudoSeats)} className={selectClass}>
                <option value={2}>2 players</option>
                <option value={4}>4 players</option>
              </select>
            </label>
          ) : (
            <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[13px] text-slate-200">
              <div className="font-[700]">Room style</div>
              <div className="mt-1 leading-6">{game === 'words' ? 'Human-only rack duel.' : game === 'scrabble' ? 'Shared board, hidden racks, optional rack-peak offers.' : 'Head-to-head skill table.'}</div>
            </div>
          )}
          <label className="block text-[12.8px]">
            <div className="mb-3 font-[700] text-[var(--muted)]">Listing</div>
            <select value={inviteScope} disabled={rule.privateInviteOnly} onChange={(event)=>setInviteScope(event.target.value as 'public'|'private')} className={selectClass}>
              {rule.supportsPublicLobby && <option value="public">Post in public lobby</option>}
              <option value="private">{rule.privateInviteOnly ? 'Invite-only room' : 'Private invite room'}</option>
            </select>
          </label>
        </div>

        <Card className="bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">Direct invites</div>
              <div className="mt-1 text-[16px] font-[700] tracking-tight text-white">Invite multiple existing friends and add email referrals.</div>
              <div className="mt-1 text-[12.8px] text-slate-300">Public listings can still send direct invites. Private rooms stay visible only to invited users and accepted participants.</div>
            </div>
            <Pill>{directInviteCount} queued</Pill>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-[12.8px] font-[700] text-[var(--muted)]">Choose friends already online</div>
            <div className="flex flex-wrap gap-2">
              {friendPool.length === 0 && <span className="text-[12.8px] text-slate-400">No matching friends online for this game right now.</span>}
              {friendPool.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => toggleFriend(player.id)}
                  className={cn(
                    `${optionChipClass} text-[13px]`,
                    selectedFriendIds.includes(player.id)
                      ? 'border-[rgba(184,250,51,0.24)] bg-[var(--lime)] text-[#0d1117]'
                      : 'text-slate-100 hover:bg-white/[0.04]',
                  )}
                >
                  {player.avatar} {player.name} • @{player.username}{player.online === false ? ' • offline' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <Field
              label="Invite by username"
              type="text"
              value={usernameQuery}
              onChange={(event) => setUsernameQuery(event.target.value)}
              placeholder="@friendusername"
            />
            <Button onClick={() => addFriendByUsername()}>Add username</Button>
          </div>

          {!!usernameMatches.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {usernameMatches.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => addFriendByUsername(player.username)}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[12.8px] text-slate-200 transition hover:bg-white/[0.06]"
                >
                  {player.avatar} {player.name} • @{player.username}{player.online === false ? ' • offline' : ''}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <Field
              label="Invite by email (referral)"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="friend@example.com"
            />
            <Button onClick={addInviteEmail}>Add email</Button>
          </div>

          {!!inviteHint && <div className="mt-2 text-[12.6px] text-slate-300">{inviteHint}</div>}

          {(selectedFriends.length > 0 || inviteEmails.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedFriends.map((friend) => (
                <span key={friend.id} className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[12.6px] text-slate-100">
                  {friend.avatar} {friend.name} • @{friend.username}
                  <button type="button" onClick={() => toggleFriend(friend.id)} className="text-slate-400">✕</button>
                </span>
              ))}
              {inviteEmails.map((email) => (
                <span key={email} className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/[0.12] px-3 py-1.5 text-[12.6px] text-sky-100">
                  ✉ {email}
                  <button type="button" onClick={() => setInviteEmails((current) => current.filter((entry) => entry !== email))} className="text-sky-200">✕</button>
                </span>
              ))}
            </div>
          )}
        </Card>

        <div className="rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[13px] leading-6 text-slate-200">
          Pot: {money(totalPot)} • Platform fee 7% • {split === 'winner_takes_all' ? `Winner receives ${money(payout)}` : `Top seat receives ${money(payout)} • runner-up receives ${money(totalPot * 0.279)}`} <br/>
          {game === 'words'
            ? 'WordForge quick play can be posted publicly, invited by username, or shared after posting. Email referrals stay stored here until automatic delivery is wired up.'
            : game === 'scrabble'
              ? 'Scrabble quick play can be posted publicly, invited by username, or shared after posting. Email referrals stay stored here until automatic delivery is wired up.'
              : game === 'ludo'
                ? `${ludoSeats}-seat ${inviteScope === 'private' ? 'private room' : 'lobby room'} with optional direct invites.`
                : 'Direct email referrals are stored in the challenge. Hook up a mail service later if you want them delivered automatically.'}
        </div>

        <div className="grid gap-2 pt-1 sm:grid-cols-3">
          <Button
            className="justify-center"
            disabled={actionsDisabled}
            onClick={async () => submitChallenge(false)}
          >
            {directInviteCount
              ? `Post & invite ${directInviteCount} contact${directInviteCount === 1 ? '' : 's'}`
              : inviteScope === 'private'
                ? 'Create private challenge'
                : 'Post challenge'}
          </Button>
          <Button variant="secondary" disabled={actionsDisabled} onClick={async () => submitChallenge(true)}>Post & share</Button>
          <Button variant="soft" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
