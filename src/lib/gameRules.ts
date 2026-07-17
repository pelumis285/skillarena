import type { GameId } from './types';

export const GAME_RULES: Record<GameId, {
  supportsSolo: boolean;
  supportsFriends: boolean;
  supportsPublicLobby: boolean;
  privateInviteOnly: boolean;
  quickPlayLabel: string;
  wagerLabel: string;
}> = {
  words: {
    supportsSolo: false,
    supportsFriends: true,
    supportsPublicLobby: true,
    privateInviteOnly: false,
    quickPlayLabel: 'Quick play',
    wagerLabel: 'Private invite',
  },
  scrabble: {
    supportsSolo: false,
    supportsFriends: true,
    supportsPublicLobby: true,
    privateInviteOnly: false,
    quickPlayLabel: 'Quick play',
    wagerLabel: 'Private invite',
  },
  chess: {
    supportsSolo: true,
    supportsFriends: true,
    supportsPublicLobby: true,
    privateInviteOnly: false,
    quickPlayLabel: 'Quick play',
    wagerLabel: 'Wager ₦5,000',
  },
  ludo: {
    supportsSolo: true,
    supportsFriends: true,
    supportsPublicLobby: true,
    privateInviteOnly: false,
    quickPlayLabel: 'Quick play',
    wagerLabel: 'Wager ₦5,000',
  },
  whot: {
    supportsSolo: true,
    supportsFriends: true,
    supportsPublicLobby: true,
    privateInviteOnly: false,
    quickPlayLabel: 'Quick play',
    wagerLabel: 'Wager ₦5,000',
  },
};

export function inviteCodePrefix(game: GameId) {
  if (game === 'words') return 'WFG';
  if (game === 'scrabble') return 'SCR';
  if (game === 'chess') return 'CHS';
  if (game === 'whot') return 'WHT';
  return 'LUD';
}
