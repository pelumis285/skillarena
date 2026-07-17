import { io, type Socket } from 'socket.io-client';
import type { Challenge, ChallengeRoomState, LudoMatchState, RoomChatMessage, User } from './types';

type PlayerIdentity = {
  id: string;
  name: string;
  avatar: string;
  rating?: number;
};

type ChallengeEvent = 'challenge:upsert' | 'invite:received';
const CONNECT_TIMEOUT_MS = 15000;
const ACK_TIMEOUT_MS = 6000;
const DEFAULT_LIVE_REALTIME_URL = 'https://skillarena-beta-api.onrender.com';

function resolveRealtimeUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_URL) {
    return import.meta.env.VITE_REALTIME_URL as string;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isBrowserHttp = protocol === 'http:' || protocol === 'https:';
    if (isBrowserHttp && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return `${protocol}//${hostname}:3001`;
    }
  }
  return DEFAULT_LIVE_REALTIME_URL;
}

function toIdentity(user: User): PlayerIdentity {
  return {
    id: user.id,
    name: user.displayName,
    avatar: user.avatar,
    rating: user.rating,
  };
}

class RealtimeClient {
  private socket: Socket | null = null;
  private currentUserId: string | null = null;
  private currentIdentity: PlayerIdentity | null = null;

  get endpoint() {
    return resolveRealtimeUrl();
  }

  get isConfigured() {
    return Boolean(this.endpoint);
  }

  async connect(user: User) {
    const endpoint = this.endpoint;
    if (!endpoint) return false;

    if (!this.socket) {
      this.socket = io(endpoint, {
        autoConnect: true,
        transports: ['websocket'],
      });
      this.socket.on('connect', () => {
        if (this.currentIdentity) {
          this.socket?.emit('player:identify', this.currentIdentity);
        }
      });
    }

    if (!this.socket.connected) {
      const connected = await new Promise<boolean>((resolve) => {
        const finish = (value: boolean) => {
          window.clearTimeout(timeout);
          this.socket?.off('connect', handleConnect);
          this.socket?.off('connect_error', handleError);
          resolve(value);
        };
        const timeout = window.setTimeout(() => {
          finish(false);
        }, CONNECT_TIMEOUT_MS);
        const handleConnect = () => {
          finish(true);
        };
        const handleError = (error: Error) => {
          console.error(error);
        };

        this.socket?.once('connect', handleConnect);
        this.socket?.on('connect_error', handleError);
      });
      if (!connected) return false;
    }

    if (!this.socket?.connected) return false;

    const identity = toIdentity(user);
    this.currentIdentity = identity;
    this.socket.emit('player:identify', identity);
    this.currentUserId = user.id;
    return true;
  }

  async listChallenges() {
    if (!this.socket?.connected) return null;
    return this.emitWithAck<Challenge[]>('challenge:list');
  }

  async createChallenge(challenge: Omit<Challenge, 'createdAt' | 'status' | 'participants' | 'seatsFilled' | 'roomId'>) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; challenge?: Challenge; error?: string }>('challenge:create', challenge);
    if (!response.ok) throw new Error(response.error || 'Unable to create challenge.');
    return response.challenge ?? null;
  }

  async acceptChallenge(challengeId: string, user: User) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; challenge?: Challenge; roomState?: ChallengeRoomState; error?: string }>('challenge:accept', {
      challengeId,
      user: toIdentity(user),
    });
    if (!response.ok) throw new Error(response.error || 'Unable to accept challenge.');
    return response;
  }

  async joinRoom(roomId: string, user: User) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; roomState?: ChallengeRoomState; error?: string }>('room:join', {
      roomId,
      user: toIdentity(user),
    });
    if (!response.ok) throw new Error(response.error || 'Unable to join room.');
    return response.roomState ?? null;
  }

  async spectateRoom(roomId: string, user: User) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; roomState?: ChallengeRoomState; error?: string }>('room:spectate', {
      roomId,
      user: toIdentity(user),
    });
    if (!response.ok) throw new Error(response.error || 'Unable to watch this room.');
    return response.roomState ?? null;
  }

  async listRoomMessages(roomId: string) {
    if (!this.socket?.connected) return [];
    const response = await this.emitWithAck<{ ok: boolean; messages?: RoomChatMessage[]; error?: string }>('chat:list', {
      roomId,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to load room chat.');
    return response.messages ?? [];
  }

  async sendRoomMessage(roomId: string, text: string) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; message?: RoomChatMessage; error?: string }>('chat:send', {
      roomId,
      text,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to send this message.');
    return response.message ?? null;
  }

  async supportRoomPlayer(roomId: string, userId: string, targetUserId?: string | null) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; roomState?: ChallengeRoomState; error?: string }>('room:support', {
      roomId,
      userId,
      targetUserId: targetUserId ?? null,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to update support right now.');
    return response.roomState ?? null;
  }

  async setRoomReady(roomId: string, userId: string, ready: boolean) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; roomState?: ChallengeRoomState; error?: string }>('room:ready', {
      roomId,
      userId,
      ready,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to update room readiness.');
    return response.roomState ?? null;
  }

  async startLudo(roomId: string, userId: string, stake?: number) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; match?: LudoMatchState; error?: string }>('ludo:start', {
      roomId,
      userId,
      stake,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to start the Ludo match.');
    return response.match ?? null;
  }

  async rollLudo(roomId: string, userId: string) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; match?: LudoMatchState; error?: string }>('ludo:roll', {
      roomId,
      userId,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to roll for this Ludo turn.');
    return response.match ?? null;
  }

  async moveLudo(roomId: string, userId: string, laneId: string, tokenId: number) {
    if (!this.socket?.connected) return null;
    const response = await this.emitWithAck<{ ok: boolean; match?: LudoMatchState; error?: string }>('ludo:move', {
      roomId,
      userId,
      laneId,
      tokenId,
    });
    if (!response.ok) throw new Error(response.error || 'Unable to move that Ludo token.');
    return response.match ?? null;
  }

  onChallenge(event: ChallengeEvent, handler: (challenge: Challenge) => void) {
    this.socket?.on(event, handler);
    return () => this.socket?.off(event, handler);
  }

  onRoom(handler: (roomState: ChallengeRoomState) => void) {
    this.socket?.on('room:state', handler);
    return () => this.socket?.off('room:state', handler);
  }

  onLudoState(handler: (matchState: LudoMatchState) => void) {
    this.socket?.on('ludo:state', handler);
    return () => this.socket?.off('ludo:state', handler);
  }

  onRoomMessage(handler: (message: RoomChatMessage) => void) {
    this.socket?.on('chat:message', handler);
    return () => this.socket?.off('chat:message', handler);
  }

  private emitWithAck<T>(event: string, payload?: unknown) {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected.'));
        return;
      }
      const timeout = window.setTimeout(() => reject(new Error(`Timed out waiting for ${event}.`)), ACK_TIMEOUT_MS);
      this.socket.emit(event, payload, (response: T) => {
        window.clearTimeout(timeout);
        resolve(response);
      });
    });
  }
}

export const realtimeClient = new RealtimeClient();
