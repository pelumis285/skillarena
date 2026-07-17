import React from 'react';
import { realtimeClient } from '../lib/realtime';
import type { Challenge, ChallengeRoomState, RoomChatMessage, User } from '../lib/types';
import { cn } from '../lib/utils';
import { gameFieldClass, gamePillClass, GamePanel } from './GameShell';
import { Button, Pill } from './ui';

function resolveRoomId(challenge?: Challenge) {
  if (!challenge) return null;
  return challenge.roomId ?? `room-${challenge.id}`;
}

function mergeMessages(existing: RoomChatMessage[], incoming: RoomChatMessage[]) {
  const byId = new Map<string, RoomChatMessage>();
  [...existing, ...incoming].forEach((message) => {
    byId.set(message.id, message);
  });
  return [...byId.values()].sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime());
}

function formatShortTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function GameChat({
  challenge,
  user,
  className = '',
}: {
  challenge?: Challenge;
  user: User;
  className?: string;
}) {
  const roomId = resolveRoomId(challenge);
  const [messages, setMessages] = React.useState<RoomChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [status, setStatus] = React.useState<'offline' | 'connecting' | 'ready'>('connecting');
  const [note, setNote] = React.useState('Live room chat stays private to the people inside this match.');
  const [roomState, setRoomState] = React.useState<ChallengeRoomState | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const pushMessages = React.useCallback((incoming: RoomChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((current) => mergeMessages(current, incoming));
  }, []);

  React.useEffect(() => {
    if (!roomId) return;
    if (!realtimeClient.isConfigured) {
      setStatus('offline');
      setNote('Chat will appear here once the realtime server is connected.');
      return;
    }

    let disposed = false;
    setStatus('connecting');
    setNote(challenge?.inviteCode ? `Joining room ${challenge.inviteCode}…` : 'Connecting live room chat…');

    const offMessage = realtimeClient.onRoomMessage((message) => {
      if (disposed || message.roomId !== roomId) return;
      pushMessages([message]);
      setStatus('ready');
    });
    const offRoom = realtimeClient.onRoom((nextRoom) => {
      if (disposed || nextRoom.roomId !== roomId) return;
      setRoomState(nextRoom);
    });

    async function joinChat() {
      if (!roomId) return;
      const activeRoomId = roomId;
      const connected = await realtimeClient.connect(user).catch(() => false);
      if (!connected || disposed) {
        if (!disposed) {
          setStatus('offline');
          setNote('Could not connect to the live room chat right now.');
        }
        return;
      }

      const isParticipant = challenge?.creator.id === user.id || !!challenge?.participants?.some((participant) => participant.id === user.id);
      const canSpectate = !!challenge?.allowSpectators || !!challenge?.tournamentId || (challenge?.game === 'ludo' && challenge?.inviteScope !== 'private');
      const joined = await (isParticipant || !canSpectate
        ? realtimeClient.joinRoom(activeRoomId, user)
        : realtimeClient.spectateRoom(activeRoomId, user)).catch(() => null);
      if (!joined || disposed) {
        if (!disposed) {
          setStatus('offline');
          setNote('This room is not open for chat yet.');
        }
        return;
      }

      const nextMessages = await realtimeClient.listRoomMessages(activeRoomId).catch(() => null);
      if (disposed) return;

      if (nextMessages) {
        pushMessages(nextMessages);
        setRoomState(joined);
        setStatus('ready');
        setNote(challenge?.inviteCode ? `Room ${challenge.inviteCode} chat is live.` : 'Room chat is live.');
      } else {
        setStatus('offline');
        setNote('Could not load the latest room messages.');
      }
    }

    joinChat();
    return () => {
      disposed = true;
      offMessage();
      offRoom();
    };
  }, [challenge?.inviteCode, pushMessages, roomId, user]);

  React.useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  if (!roomId) return null;

  const supportCounts = new Map<string, number>();
  roomState?.spectators?.forEach((spectator) => {
    if (!spectator.supportTargetUserId) return;
    supportCounts.set(spectator.supportTargetUserId, (supportCounts.get(spectator.supportTargetUserId) ?? 0) + 1);
  });
  const mySupportTarget = roomState?.spectators?.find((spectator) => spectator.id === user.id)?.supportTargetUserId ?? null;

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!roomId) return;
    const activeRoomId = roomId;

    setSending(true);
    try {
      const connected = await realtimeClient.connect(user).catch(() => false);
      if (!connected) throw new Error('Socket unavailable');
      await realtimeClient.sendRoomMessage(activeRoomId, text);
      setDraft('');
      setStatus('ready');
    } catch {
      setStatus('offline');
      setNote('That message did not go through. Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const supportPlayer = async (targetUserId: string | null) => {
    if (!roomId) return;
    try {
      const connected = await realtimeClient.connect(user).catch(() => false);
      if (!connected) throw new Error('Socket unavailable');
      const nextRoom = await realtimeClient.supportRoomPlayer(roomId, user.id, targetUserId);
      if (nextRoom) setRoomState(nextRoom);
    } catch {
      setNote('Could not update your support reaction just now.');
    }
  };

  return (
    <GamePanel className={cn('p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Room chat</div>
          <div className="mt-1 text-[20px] font-[700] tracking-tight text-white">Talk while you play</div>
        </div>
        <Pill className={status === 'ready' ? 'border border-emerald-400/20 bg-emerald-500/14 text-emerald-200' : gamePillClass}>
          {status === 'ready' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
        </Pill>
      </div>

      {!!roomState?.participants.length && (
        <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-[700] uppercase tracking-[0.18em] text-slate-300">Support a player</div>
            <div className="text-[12px] text-slate-400">{roomState.spectators?.length ?? 0} watcher{(roomState.spectators?.length ?? 0) === 1 ? '' : 's'}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {roomState.participants.map((participant) => {
              const active = mySupportTarget === participant.id;
              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => supportPlayer(active ? null : participant.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12.8px] font-[650] transition',
                    active
                      ? 'border-amber-300/35 bg-amber-300/18 text-amber-100'
                      : 'border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]',
                  )}
                >
                  <span>{participant.avatar}</span>
                  <span>{participant.name}</span>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-white">{supportCounts.get(participant.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={listRef} className="mt-4 h-[260px] overflow-y-auto rounded-[22px] border border-white/10 bg-white/[0.04] p-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-[13.2px] leading-6 text-slate-400">
            {status === 'ready'
              ? 'No messages yet. Break the silence before the next move.'
              : 'Joining the room so everyone can chat live.'}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const mine = message.sender.id === user.id;
              return (
                <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-[20px] border px-3 py-2.5',
                      mine
                        ? 'border-indigo-400/20 bg-indigo-500/[0.16] text-white'
                        : 'border-white/10 bg-white/[0.08] text-slate-100',
                    )}
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{message.sender.avatar}</span>
                      <span>{mine ? 'You' : message.sender.name}</span>
                      <span>{formatShortTime(message.sentAt)}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-5">{message.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              sendMessage();
            }
          }}
          maxLength={280}
          placeholder={status === 'ready' ? 'Send a message…' : 'Connecting chat…'}
          disabled={status !== 'ready' || sending}
          className={cn('flex-1 rounded-[18px] px-4 py-3 text-[14px] outline-none', gameFieldClass)}
        />
        <Button onClick={sendMessage} disabled={status !== 'ready' || sending || !draft.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      <div className="mt-2 text-[12.4px] leading-5 text-slate-400">{note}</div>
    </GamePanel>
  );
}
