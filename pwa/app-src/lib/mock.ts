import type { Challenge, MatchRecord, OnlinePlayer, Tournament, WalletTx } from './types';

export const AVATARS = [
  "🦊","🦉","🐯","🐉","🐺","🦄","🦅","🦁","🐙","🐼","🦋","🌙"
];

export const GAME_META = {
  words: {
    name: 'WordForge',
    short: 'Words',
    tagline: 'Human-only rack duels. Public or invited rooms.',
    color: '#f59e0b',
    bg: '#fff7ed',
    darkBg: '#221306',
    accent: 'amber',
    emoji: '🔤',
    players: '640 online',
  },
  scrabble: {
    name: 'Scrabble Social',
    short: 'Scrabble',
    tagline: 'Board words. Shareable tables. Rack secrets.',
    color: '#2563eb',
    bg: '#eef4ff',
    darkBg: '#0a1324',
    accent: 'blue',
    emoji: '🔠',
    players: '860 online',
  },
  chess: {
    name: 'Grandline Chess',
    short: 'Chess',
    tagline: 'Blitz & Classic. FIDE rated.',
    color: '#7c6c5a',
    bg: '#f8f4ef',
    darkBg: '#15120e',
    accent: 'stone',
    emoji: '♞',
    players: '2.1k online',
  },
  ludo: {
    name: 'Ludo Rush',
    short: 'Ludo',
    tagline: 'Four tokens. One throne.',
    color: '#e05c4a',
    bg: '#fff2f0',
    darkBg: '#27110d',
    accent: 'red',
    emoji: '🎲',
    players: '980 online',
  },
  whot: {
    name: 'Whot!',
    short: 'Whot',
    tagline: 'Naija rules. Fast hands. Wild calls.',
    color: '#0f766e',
    bg: '#ecfeff',
    darkBg: '#081b1c',
    accent: 'teal',
    emoji: '🃏',
    players: '1.2k online',
  }
} as const;

export const mockOnlinePlayers: OnlinePlayer[] = [
  { id:'p1', name:'Valentin R.', username:'valentinr', avatar:'🦉', rating:1822, game:'chess', wlr:'73%', stakePref:'₦5k–₦25k' },
  { id:'p2', name:'Mara Kim', username:'marakim', avatar:'🐯', rating:1674, game:'words', wlr:'66%', stakePref:'₦2k–₦10k' },
  { id:'p3', name:'Theo L.', username:'theol', avatar:'🦊', rating:1912, game:'chess', wlr:'81%', stakePref:'₦20k–₦60k' },
  { id:'p4', name:'Sofia A.', username:'sofiaace', avatar:'🦄', rating:1540, game:'ludo', wlr:'58%', stakePref:'₦1k–₦5k' },
  { id:'p5', name:'Jace', username:'jaceplays', avatar:'🐺', rating:1735, game:'words', wlr:'71%', stakePref:'₦5k–₦15k' },
  { id:'p6', name:'Amina Z.', username:'aminaz', avatar:'🦅', rating:2004, game:'chess', wlr:'84%', stakePref:'₦30k–₦100k' },
  { id:'p7', name:'Luis G.', username:'luisg', avatar:'🐙', rating:1499, game:'ludo', wlr:'62%', stakePref:'₦3k–₦12k' },
  { id:'p8', name:'Nora', username:'noraspell', avatar:'🦋', rating:1602, game:'words', wlr:'69%', stakePref:'₦2k–₦8k' },
  { id:'p9', name:'Kemi D.', username:'kemid', avatar:'🦚', rating:1718, game:'whot', wlr:'74%', stakePref:'₦3k–₦18k' },
  { id:'p10', name:'Tunde B.', username:'tundeb', avatar:'🐢', rating:1661, game:'whot', wlr:'68%', stakePref:'₦2k–₦12k' },
  { id:'p11', name:'Bola N.', username:'bolan', avatar:'🐝', rating:1688, game:'ludo', wlr:'77%', stakePref:'₦4k–₦20k' },
  { id:'p12', name:'Ife A.', username:'ifea', avatar:'🪷', rating:1584, game:'ludo', wlr:'64%', stakePref:'₦2k–₦10k' },
  { id:'p13', name:'Chioma V.', username:'chiomav', avatar:'🦢', rating:1766, game:'scrabble', wlr:'72%', stakePref:'₦4k–₦18k' },
  { id:'p14', name:'David P.', username:'davidp', avatar:'🐬', rating:1695, game:'scrabble', wlr:'67%', stakePref:'₦3k–₦12k' },
];

export const mockChallenges: Challenge[] = [
  { id:'c1', game:'chess', stake:12000, split:'winner_takes_all', creator:{id:'p1', name:'Valentin R.', avatar:'🦉', rating:1822}, createdAt:new Date(Date.now()-1000*60*8).toISOString(), status:'open'},
  { id:'c2', game:'words', stake:5000, split:'winner_takes_all', inviteScope:'private', invitedUserId:'u_me', invitedUserName:'Archer', invitedUsers:[{ id:'u_me', name:'Archer' }, { id:'p8', name:'Nora', avatar:'🦋', rating:1602 }], invitedEmails:['teammate@example.com'], inviteCode:'WFG-418', creator:{id:'p2', name:'Mara Kim', avatar:'🐯', rating:1674}, createdAt:new Date(Date.now()-1000*60*3).toISOString(), status:'open'},
  { id:'c3', game:'ludo', stake:8000, split:'70_30', mode:'friends', seats:4, inviteScope:'public', creator:{id:'p4', name:'Sofia A.', avatar:'🦄', rating:1540}, createdAt:new Date(Date.now()-1000*60*12).toISOString(), status:'open'},
  { id:'c4', game:'chess', stake:40000, split:'winner_takes_all', creator:{id:'p6', name:'Amina Z.', avatar:'🦅', rating:2004}, createdAt:new Date(Date.now()-1000*60*2).toISOString(), status:'open'},
  { id:'c5', game:'whot', stake:6000, split:'winner_takes_all', creator:{id:'p9', name:'Kemi D.', avatar:'🦚', rating:1718}, createdAt:new Date(Date.now()-1000*60*5).toISOString(), status:'open'},
  { id:'c6', game:'ludo', stake:5000, split:'winner_takes_all', mode:'friends', seats:2, inviteScope:'private', invitedUserId:'p11', invitedUserName:'Bola N.', invitedUsers:[{ id:'p11', name:'Bola N.', avatar:'🐝', rating:1688 }], inviteCode:'LUDO-742', creator:{id:'p12', name:'Ife A.', avatar:'🪷', rating:1584}, createdAt:new Date(Date.now()-1000*60*6).toISOString(), status:'open'},
  { id:'c7', game:'scrabble', stake:7000, split:'winner_takes_all', inviteScope:'public', invitedUsers:[{ id:'p14', name:'David P.', avatar:'🐬', rating:1695 }], invitedEmails:['studygroup@example.com'], inviteCode:'SCR-804', creator:{id:'p13', name:'Chioma V.', avatar:'🦢', rating:1766}, createdAt:new Date(Date.now()-1000*60*7).toISOString(), status:'open'},
  { id:'c8', game:'scrabble', stake:9000, split:'winner_takes_all', inviteScope:'private', invitedUserId:'u_me', invitedUserName:'Archer', invitedUsers:[{ id:'u_me', name:'Archer' }, { id:'p13', name:'Chioma V.', avatar:'🦢', rating:1766 }], inviteCode:'SCR-226', creator:{id:'p14', name:'David P.', avatar:'🐬', rating:1695}, createdAt:new Date(Date.now()-1000*60*4).toISOString(), status:'open'},
];

export const mockTransactions: WalletTx[] = [
  { id:'t1', type:'deposit', amount: 50000, status:'completed', description:'Bank transfer • Providus 2048', at: new Date(Date.now()-86400000*2).toISOString() },
  { id:'t2', type:'wager', amount: -10000, status:'completed', description:'WordForge match entry', game:'words', at: new Date(Date.now()-86400000*2+3600000).toISOString() },
  { id:'t3', type:'win', amount: 18600, status:'completed', description:'WordForge win vs. Mara', game:'words', at: new Date(Date.now()-86400000*2+3800000).toISOString() },
  { id:'t4', type:'wager', amount: -15000, status:'completed', description:'Chess blitz entry', game:'chess', at: new Date(Date.now()-86400000).toISOString() },
  { id:'t5', type:'refund', amount: 15000, status:'completed', description:'Draw refund • Theo L.', game:'chess', at: new Date(Date.now()-86400000+1900000).toISOString() },
  { id:'t6', type:'deposit', amount: 30000, status:'completed', description:'USSD top-up • GTBank', at: new Date(Date.now()-3600000*8).toISOString() },
];

export const mockMatches: MatchRecord[] = [
  { id:'m1', game:'words', opponent:{ name:'Mara Kim', avatar:'🐯'}, result:'win', score:'412–351', stake:10000, payout:18600, at:new Date(Date.now()-86400000*2).toISOString()},
  { id:'m2', game:'chess', opponent:{ name:'Theo L.', avatar:'🦊'}, result:'draw', score:'½–½', stake:15000, payout:15000, at:new Date(Date.now()-86400000).toISOString()},
  { id:'m3', game:'ludo', opponent:{ name:'Sofia A.', avatar:'🦄'}, result:'win', score:'4–2 tokens', stake:4000, payout:7440, at:new Date(Date.now()-86400000*3).toISOString()},
  { id:'m4', game:'words', opponent:{ name:'Jace', avatar:'🐺'}, result:'loss', score:'288–331', stake:6000, payout:0, at:new Date(Date.now()-86400000*4).toISOString()},
  { id:'m5', game:'chess', opponent:{ name:'Valentin R.', avatar:'🦉'}, result:'win', score:'1–0', stake:12000, payout:22320, at:new Date(Date.now()-86400000*5).toISOString()},
  { id:'m6', game:'whot', opponent:{ name:'Kemi D.', avatar:'🦚'}, result:'win', score:'32 deadwood', stake:6000, payout:11160, at:new Date(Date.now()-86400000*2+5400000).toISOString()},
  { id:'m7', game:'scrabble', opponent:{ name:'Chioma V.', avatar:'🦢'}, result:'win', score:'318–274', stake:7000, payout:13020, at:new Date(Date.now()-86400000*6).toISOString()},
];

export const FEATURED_TOURNAMENT = {
  id: 'season-crown-cup',
  title: 'Season Crown Cup',
  subtitle: 'Cross-game finals with seeded brackets and live staking.',
  prizePool: '₦500K',
  startsIn: 'Starts in 2h 45m',
  entryLabel: 'Join for ₦10,000',
  game: 'chess' as const,
};

export const mockTournaments: Tournament[] = [
  {
    id: 'tour-ludo-finals',
    title: 'Ludo Kings Weekend Cup',
    game: 'ludo',
    stake: 5000,
    maxPlayers: 8,
    seatsPerMatch: 4,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: 'live',
    allowSpectators: true,
    prizePool: 37200,
    creator: { id: 'p11', name: 'Bola N.', avatar: '🐝', rating: 1688 },
    participants: [
      { id: 'p11', name: 'Bola N.', avatar: '🐝', rating: 1688, joinedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString() },
      { id: 'p12', name: 'Ife A.', avatar: '🪷', rating: 1584, joinedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
      { id: 'p4', name: 'Sofia A.', avatar: '🦄', rating: 1540, joinedAt: new Date(Date.now() - 1000 * 60 * 39).toISOString() },
      { id: 'p7', name: 'Luis G.', avatar: '🐙', rating: 1499, joinedAt: new Date(Date.now() - 1000 * 60 * 37).toISOString() },
      { id: 'u_me', name: 'Archer', avatar: '🦊', rating: 1642, joinedAt: new Date(Date.now() - 1000 * 60 * 34).toISOString() },
      { id: 'p10', name: 'Tunde B.', avatar: '🐢', rating: 1661, joinedAt: new Date(Date.now() - 1000 * 60 * 33).toISOString() },
      { id: 'p9', name: 'Kemi D.', avatar: '🦚', rating: 1718, joinedAt: new Date(Date.now() - 1000 * 60 * 31).toISOString() },
      { id: 'p14', name: 'David P.', avatar: '🐬', rating: 1695, joinedAt: new Date(Date.now() - 1000 * 60 * 29).toISOString() },
    ],
    rounds: [
      {
        index: 0,
        label: 'Group stage',
        matches: [
          { id: 'lm1', roundIndex: 0, position: 0, seats: 4, status: 'finished', participants: [], winnerUserId: 'p11' },
          { id: 'lm2', roundIndex: 0, position: 1, seats: 4, status: 'in_progress', participants: [], winnerUserId: null },
        ],
      },
      {
        index: 1,
        label: 'Final table',
        matches: [
          { id: 'lm3', roundIndex: 1, position: 0, seats: 2, status: 'waiting', participants: [], winnerUserId: null },
        ],
      },
    ],
    currentRound: 0,
  },
  {
    id: 'tour-scrabble-night',
    title: 'Scrabble Social Night Ladder',
    game: 'scrabble',
    stake: 7000,
    maxPlayers: 8,
    seatsPerMatch: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    status: 'open',
    allowSpectators: true,
    prizePool: 52080,
    creator: { id: 'p13', name: 'Chioma V.', avatar: '🦢', rating: 1766 },
    participants: [
      { id: 'p13', name: 'Chioma V.', avatar: '🦢', rating: 1766, joinedAt: new Date(Date.now() - 1000 * 60 * 19).toISOString() },
      { id: 'p14', name: 'David P.', avatar: '🐬', rating: 1695, joinedAt: new Date(Date.now() - 1000 * 60 * 16).toISOString() },
      { id: 'u_me', name: 'Archer', avatar: '🦊', rating: 1642, joinedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    ],
    rounds: [],
    currentRound: 0,
  },
];

export const DAILY_MISSIONS = [
  {
    id: 'mission_words_post',
    game: 'words' as const,
    title: 'Post a WordForge duel',
    detail: 'Create one public or private rack challenge.',
    progress: 1,
    target: 1,
    reward: 2000,
  },
  {
    id: 'mission_ludo_finish',
    game: 'ludo' as const,
    title: 'Finish one Ludo Rush table',
    detail: 'Clear a heads-up room before midnight.',
    progress: 1,
    target: 1,
    reward: 4000,
  },
  {
    id: 'mission_chess_stake',
    game: 'chess' as const,
    title: 'Play three Chess stakes',
    detail: 'Any stake amount counts toward the ladder.',
    progress: 2,
    target: 3,
    reward: 6000,
  },
] as const;

export const ACHIEVEMENT_HIGHLIGHTS = [
  {
    id: 'achv_ludo',
    title: 'Ludo King',
    detail: 'Win 100 Ludo Rush matches',
    accent: 'amber',
    emoji: '👑',
  },
  {
    id: 'achv_scrabble',
    title: 'Rack Reader',
    detail: 'Accept 10 Scrabble peek offers',
    accent: 'indigo',
    emoji: '🔍',
  },
  {
    id: 'achv_words',
    title: 'Wordsmith',
    detail: 'Score 300+ in WordForge',
    accent: 'emerald',
    emoji: '🔤',
  },
  {
    id: 'achv_tourney',
    title: 'Tourney Champ',
    detail: 'Win a 50+ player bracket',
    accent: 'rose',
    emoji: '🏆',
  },
] as const;
