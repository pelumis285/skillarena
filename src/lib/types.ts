export type GameId = 'words' | 'chess' | 'ludo' | 'whot' | 'scrabble';
export type UserRole = 'player' | 'admin';

export type User = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  dateOfBirth: string;
  displayName: string;
  avatar: string;
  profileImage?: string | null;
  payoutBankCode?: string | null;
  payoutBankName?: string | null;
  payoutAccountNumber?: string | null;
  payoutAccountName?: string | null;
  rating: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';
  joinedAt: string;
  role?: UserRole;
  referralCode?: string;
  referredByCode?: string | null;
};

export type MatchMode = 'solo' | 'friends';
export type LudoMode = MatchMode;
export type LudoSeats = 2 | 4;
export type PlayerColor = 'green' | 'yellow' | 'red' | 'blue';
export type PlayerKind = 'you' | 'bot' | 'friend';

export type LudoToken = {
  id: number;
  progress: number;
  finished: boolean;
};

export type LudoMatchPlayer = {
  laneId: string;
  ownerId: string;
  id: string;
  name: string;
  avatar: string;
  rating?: number;
  color: PlayerColor;
  kind: PlayerKind;
  tokens: LudoToken[];
};

export type LudoLastMove = {
  laneId: string;
  tokenId: number;
  captured: boolean;
};

export type LudoMatchState = {
  roomId: string;
  challengeId: string;
  seats: LudoSeats;
  players: LudoMatchPlayer[];
  turnOrder: string[];
  turnIndex: number;
  turnOwnerId: string | null;
  dice: number | null;
  diceFace: number;
  canRoll: boolean;
  message: string;
  winnerOwnerId: string | null;
  activeStake: number;
  phase: 'playing' | 'finished';
  lastMove: LudoLastMove | null;
  updatedAt: string;
};

export type ChallengeParticipant = {
  id: string;
  name: string;
  avatar: string;
  rating?: number;
  seatIndex: number;
  ready?: boolean;
};

export type ChallengeInviteTarget = {
  id?: string;
  name: string;
  username?: string;
  avatar?: string;
  rating?: number;
  email?: string;
};

export type ChallengeRoomState = {
  roomId: string;
  challengeId: string;
  game: GameId;
  seats: LudoSeats;
  participants: ChallengeParticipant[];
  hostUserId: string;
  inviteCode?: string;
  state: 'waiting' | 'ready' | 'in_progress' | 'finished';
  spectators?: Array<{
    id: string;
    name: string;
    avatar: string;
    rating?: number;
    supportTargetUserId?: string | null;
  }>;
};

export type RoomChatMessage = {
  id: string;
  roomId: string;
  text: string;
  sentAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string;
    rating?: number;
  };
};

export type WalletTx = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'wager' | 'win' | 'refund' | 'referral_bonus' | 'adjustment';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  game?: GameId;
  at: string;
};

export type PaymentProvider = 'paystack';
export type PaymentKind = 'deposit' | 'withdrawal';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'abandoned';

export type PaymentRecord = {
  id: string;
  provider: PaymentProvider;
  kind: PaymentKind;
  userId: string;
  amount: number;
  currency: 'NGN';
  reference: string;
  status: PaymentStatus;
  description: string;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  providerTransactionId?: string | null;
  transferRecipientCode?: string | null;
  walletTransactionId?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type PaymentRuntimeConfig = {
  provider: PaymentProvider | null;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  inlineCheckoutEnabled: boolean;
  supportedDepositChannels: Array<'card' | 'bank' | 'ussd' | 'bank_transfer'>;
  message: string;
};

export type SupportedBank = {
  code: string;
  name: string;
  slug?: string;
};

export type ResolvedBankAccount = {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
};

export type MatchRecord = {
  id: string;
  game: GameId;
  opponent: { name: string; avatar: string };
  result: 'win' | 'loss' | 'draw';
  score: string;
  stake: number;
  payout: number;
  at: string;
};

export type Challenge = {
  id: string;
  game: GameId;
  stake: number;
  split: 'winner_takes_all' | '70_30';
  mode?: MatchMode;
  seats?: LudoSeats;
  creator: { id: string; name: string; avatar: string; rating: number };
  createdAt: string;
  status: 'open' | 'filled' | 'in_progress' | 'finished';
  roomId?: string;
  seatsFilled?: number;
  participants?: ChallengeParticipant[];
  inviteScope?: 'public' | 'private';
  invitedUserId?: string;
  invitedUserName?: string;
  invitedUsers?: ChallengeInviteTarget[];
  invitedEmails?: string[];
  inviteCode?: string;
  source?: 'challenge' | 'tournament';
  tournamentId?: string;
  tournamentMatchId?: string;
  allowSpectators?: boolean;
};

export type TournamentStatus = 'open' | 'live' | 'completed';
export type TournamentMatchStatus = 'waiting' | 'ready' | 'in_progress' | 'finished';

export type TournamentParticipant = {
  id: string;
  name: string;
  avatar: string;
  rating?: number;
  joinedAt: string;
};

export type TournamentMatch = {
  id: string;
  roundIndex: number;
  position: number;
  seats: 2 | 4;
  status: TournamentMatchStatus;
  participants: TournamentParticipant[];
  winnerUserId?: string | null;
  challenge?: Challenge;
};

export type TournamentRound = {
  index: number;
  label: string;
  matches: TournamentMatch[];
};

export type Tournament = {
  id: string;
  title: string;
  game: GameId;
  stake: number;
  maxPlayers: number;
  seatsPerMatch: 2 | 4;
  createdAt: string;
  status: TournamentStatus;
  allowSpectators: boolean;
  prizePool: number;
  creator: { id: string; name: string; avatar: string; rating: number };
  participants: TournamentParticipant[];
  rounds: TournamentRound[];
  currentRound: number;
};

export type OnlinePlayer = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  rating: number;
  game: GameId;
  wlr: string;
  stakePref: string;
};

export type UserPerformancePoint = {
  label: string;
  wins: number;
  losses: number;
  draws: number;
  net: number;
};

export type UserProfileTotals = {
  deposited: number;
  withdrawn: number;
  wagered: number;
  earned: number;
  net: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  referrals: number;
  referralPoints: number;
  referralEarnings: number;
};

export type ReferredPlayerSummary = {
  id: string;
  username: string;
  displayName: string;
  joinedAt: string;
  rewardAmount: number;
  rewardPoints: number;
};

export type UserProfileSnapshot = {
  user: User;
  balance: number;
  totals: UserProfileTotals;
  transactions: WalletTx[];
  matches: MatchRecord[];
  performance: UserPerformancePoint[];
  referral: {
    code: string;
    referredByCode: string | null;
    rewardPerFriend: number;
    pointsPerFriend: number;
    friends: ReferredPlayerSummary[];
  };
};

export type AdminUserSnapshot = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  dateOfBirth: string;
  displayName: string;
  joinedAt: string;
  balance: number;
  role: UserRole;
  deposited: number;
  withdrawn: number;
  wagered: number;
  earned: number;
  wins: number;
  losses: number;
  referralCount: number;
  referralPoints: number;
  referralEarnings: number;
};

export type AdminTrendPoint = {
  label: string;
  deposits: number;
  withdrawals: number;
  platformRevenue: number;
  wins: number;
  losses: number;
};

export type AdminOverviewSnapshot = {
  totals: {
    users: number;
    admins: number;
    activeUsers: number;
    fundedUsers: number;
    referredUsers: number;
    totalBalances: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalWagered: number;
    totalPayouts: number;
    totalReferralRewards: number;
    totalReferralPoints: number;
    platformRevenue: number;
  };
  trends: AdminTrendPoint[];
  recentTransactions: Array<WalletTx & { userId: string; username: string; displayName: string }>;
  topPlayers: AdminUserSnapshot[];
  topReferrers: AdminUserSnapshot[];
  users: AdminUserSnapshot[];
};
