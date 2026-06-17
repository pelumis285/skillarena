import type { Challenge, MatchRecord, OnlinePlayer, WalletTx } from './types';

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
  { id:'p1', name:'Valentin R.', username:'valentinr', avatar:'🦉', rating:1822, game:'chess', wlr:'73%', stakePref:'$5–$25' },
  { id:'p2', name:'Mara Kim', username:'marakim', avatar:'🐯', rating:1674, game:'words', wlr:'66%', stakePref:'$2–$10' },
  { id:'p3', name:'Theo L.', username:'theol', avatar:'🦊', rating:1912, game:'chess', wlr:'81%', stakePref:'$20–$60' },
  { id:'p4', name:'Sofia A.', username:'sofiaace', avatar:'🦄', rating:1540, game:'ludo', wlr:'58%', stakePref:'$1–$5' },
  { id:'p5', name:'Jace', username:'jaceplays', avatar:'🐺', rating:1735, game:'words', wlr:'71%', stakePref:'$5–$15' },
  { id:'p6', name:'Amina Z.', username:'aminaz', avatar:'🦅', rating:2004, game:'chess', wlr:'84%', stakePref:'$30–$100' },
  { id:'p7', name:'Luis G.', username:'luisg', avatar:'🐙', rating:1499, game:'ludo', wlr:'62%', stakePref:'$3–$12' },
  { id:'p8', name:'Nora', username:'noraspell', avatar:'🦋', rating:1602, game:'words', wlr:'69%', stakePref:'$2–$8' },
  { id:'p9', name:'Kemi D.', username:'kemid', avatar:'🦚', rating:1718, game:'whot', wlr:'74%', stakePref:'$3–$18' },
  { id:'p10', name:'Tunde B.', username:'tundeb', avatar:'🐢', rating:1661, game:'whot', wlr:'68%', stakePref:'$2–$12' },
  { id:'p11', name:'Bola N.', username:'bolan', avatar:'🐝', rating:1688, game:'ludo', wlr:'77%', stakePref:'$4–$20' },
  { id:'p12', name:'Ife A.', username:'ifea', avatar:'🪷', rating:1584, game:'ludo', wlr:'64%', stakePref:'$2–$10' },
  { id:'p13', name:'Chioma V.', username:'chiomav', avatar:'🦢', rating:1766, game:'scrabble', wlr:'72%', stakePref:'$4–$18' },
  { id:'p14', name:'David P.', username:'davidp', avatar:'🐬', rating:1695, game:'scrabble', wlr:'67%', stakePref:'$3–$12' },
];

export const mockChallenges: Challenge[] = [
  { id:'c1', game:'chess', stake:12, split:'winner_takes_all', creator:{id:'p1', name:'Valentin R.', avatar:'🦉', rating:1822}, createdAt:new Date(Date.now()-1000*60*8).toISOString(), status:'open'},
  { id:'c2', game:'words', stake:5, split:'winner_takes_all', inviteScope:'private', invitedUserId:'u_me', invitedUserName:'Archer', invitedUsers:[{ id:'u_me', name:'Archer' }, { id:'p8', name:'Nora', avatar:'🦋', rating:1602 }], invitedEmails:['teammate@example.com'], inviteCode:'WFG-418', creator:{id:'p2', name:'Mara Kim', avatar:'🐯', rating:1674}, createdAt:new Date(Date.now()-1000*60*3).toISOString(), status:'open'},
  { id:'c3', game:'ludo', stake:8, split:'70_30', mode:'friends', seats:4, inviteScope:'public', creator:{id:'p4', name:'Sofia A.', avatar:'🦄', rating:1540}, createdAt:new Date(Date.now()-1000*60*12).toISOString(), status:'open'},
  { id:'c4', game:'chess', stake:40, split:'winner_takes_all', creator:{id:'p6', name:'Amina Z.', avatar:'🦅', rating:2004}, createdAt:new Date(Date.now()-1000*60*2).toISOString(), status:'open'},
  { id:'c5', game:'whot', stake:6, split:'winner_takes_all', creator:{id:'p9', name:'Kemi D.', avatar:'🦚', rating:1718}, createdAt:new Date(Date.now()-1000*60*5).toISOString(), status:'open'},
  { id:'c6', game:'ludo', stake:5, split:'winner_takes_all', mode:'friends', seats:2, inviteScope:'private', invitedUserId:'p11', invitedUserName:'Bola N.', invitedUsers:[{ id:'p11', name:'Bola N.', avatar:'🐝', rating:1688 }], inviteCode:'LUDO-742', creator:{id:'p12', name:'Ife A.', avatar:'🪷', rating:1584}, createdAt:new Date(Date.now()-1000*60*6).toISOString(), status:'open'},
  { id:'c7', game:'scrabble', stake:7, split:'winner_takes_all', inviteScope:'public', invitedUsers:[{ id:'p14', name:'David P.', avatar:'🐬', rating:1695 }], invitedEmails:['studygroup@example.com'], inviteCode:'SCR-804', creator:{id:'p13', name:'Chioma V.', avatar:'🦢', rating:1766}, createdAt:new Date(Date.now()-1000*60*7).toISOString(), status:'open'},
  { id:'c8', game:'scrabble', stake:9, split:'winner_takes_all', inviteScope:'private', invitedUserId:'u_me', invitedUserName:'Archer', invitedUsers:[{ id:'u_me', name:'Archer' }, { id:'p13', name:'Chioma V.', avatar:'🦢', rating:1766 }], inviteCode:'SCR-226', creator:{id:'p14', name:'David P.', avatar:'🐬', rating:1695}, createdAt:new Date(Date.now()-1000*60*4).toISOString(), status:'open'},
];

export const mockTransactions: WalletTx[] = [
  { id:'t1', type:'deposit', amount: 50, status:'completed', description:'Stripe deposit • •••• 4242', at: new Date(Date.now()-86400000*2).toISOString() },
  { id:'t2', type:'wager', amount: -10, status:'completed', description:'WordForge match entry', game:'words', at: new Date(Date.now()-86400000*2+3600000).toISOString() },
  { id:'t3', type:'win', amount: 18.6, status:'completed', description:'WordForge win vs. Mara', game:'words', at: new Date(Date.now()-86400000*2+3800000).toISOString() },
  { id:'t4', type:'wager', amount: -15, status:'completed', description:'Chess blitz entry', game:'chess', at: new Date(Date.now()-86400000).toISOString() },
  { id:'t5', type:'refund', amount: 15, status:'completed', description:'Draw refund • Theo L.', game:'chess', at: new Date(Date.now()-86400000+1900000).toISOString() },
  { id:'t6', type:'deposit', amount: 30, status:'completed', description:'Apple Pay', at: new Date(Date.now()-3600000*8).toISOString() },
];

export const mockMatches: MatchRecord[] = [
  { id:'m1', game:'words', opponent:{ name:'Mara Kim', avatar:'🐯'}, result:'win', score:'412–351', stake:10, payout:18.6, at:new Date(Date.now()-86400000*2).toISOString()},
  { id:'m2', game:'chess', opponent:{ name:'Theo L.', avatar:'🦊'}, result:'draw', score:'½–½', stake:15, payout:15, at:new Date(Date.now()-86400000).toISOString()},
  { id:'m3', game:'ludo', opponent:{ name:'Sofia A.', avatar:'🦄'}, result:'win', score:'4–2 tokens', stake:4, payout:7.44, at:new Date(Date.now()-86400000*3).toISOString()},
  { id:'m4', game:'words', opponent:{ name:'Jace', avatar:'🐺'}, result:'loss', score:'288–331', stake:6, payout:0, at:new Date(Date.now()-86400000*4).toISOString()},
  { id:'m5', game:'chess', opponent:{ name:'Valentin R.', avatar:'🦉'}, result:'win', score:'1–0', stake:12, payout:22.32, at:new Date(Date.now()-86400000*5).toISOString()},
  { id:'m6', game:'whot', opponent:{ name:'Kemi D.', avatar:'🦚'}, result:'win', score:'32 deadwood', stake:6, payout:11.16, at:new Date(Date.now()-86400000*2+5400000).toISOString()},
  { id:'m7', game:'scrabble', opponent:{ name:'Chioma V.', avatar:'🦢'}, result:'win', score:'318–274', stake:7, payout:13.02, at:new Date(Date.now()-86400000*6).toISOString()},
];

export const FEATURED_TOURNAMENT = {
  id: 'season-crown-cup',
  title: 'Season Crown Cup',
  subtitle: 'Cross-game finals with seeded brackets and live staking.',
  prizePool: '$50K',
  startsIn: 'Starts in 2h 45m',
  entryLabel: 'Join for $10',
  game: 'chess' as const,
};

export const DAILY_MISSIONS = [
  {
    id: 'mission_words_post',
    game: 'words' as const,
    title: 'Post a WordForge duel',
    detail: 'Create one public or private rack challenge.',
    progress: 1,
    target: 1,
    reward: 2,
  },
  {
    id: 'mission_ludo_finish',
    game: 'ludo' as const,
    title: 'Finish one Ludo Rush table',
    detail: 'Clear a heads-up room before midnight.',
    progress: 1,
    target: 1,
    reward: 4,
  },
  {
    id: 'mission_chess_stake',
    game: 'chess' as const,
    title: 'Play three Chess stakes',
    detail: 'Any stake amount counts toward the ladder.',
    progress: 2,
    target: 3,
    reward: 6,
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
