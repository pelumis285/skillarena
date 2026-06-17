import React from 'react';
import type { User, GameId, Challenge } from './lib/types';
import { LoginScreen, RegisterScreen, VerifyScreen, OnboardScreen } from './components/AuthScreens';
import { AppShell } from './components/Layout';
import { Dashboard, LeaderboardView } from './components/Dashboard';
import { ChallengeLobby } from './components/ChallengeLobby';
import { WalletView } from './components/WalletView';
import { ProfileView } from './components/ProfileView';
import { WordForge } from './games/WordForge';
import { ChessArena } from './games/ChessArena';
import { LudoRush } from './games/LudoRush';
import { WhotArena } from './games/WhotArena';
import { ScrabbleSocial } from './games/ScrabbleSocial';
import { ToastViewport, Card, Button, Modal } from './components/ui';
import { money } from './lib/utils';
import { betaApi } from './lib/api';

type AuthState = 'login' | 'register' | 'verify' | 'onboard' | 'app';
type AppView = 'dashboard' | 'challenges' | 'leaderboard' | 'wallet' | 'profile';
type ChallengeComposerIntent = {
  game?: GameId;
  inviteScope?: 'public' | 'private';
  stake?: number;
  friendId?: string;
};

type RegistrationDraft = {
  email: string;
  username: string;
  password: string;
};

const DEFAULT_USER: User = {
  id: 'u_me',
  email: 'player@cerebrum.test',
  username: 'archer',
  displayName: 'Archer',
  avatar: '🦊',
  rating: 1642,
  tier: 'Silver',
  joinedAt: new Date().toISOString(),
};

export default function App() {
  const [authState, setAuthState] = React.useState<AuthState>(() => {
    const saved = localStorage.getItem('cerebrum_auth');
    return saved ? 'app' : 'login';
  });
  const [email, setEmail] = React.useState('player@cerebrum.test');
  const [registrationDraft, setRegistrationDraft] = React.useState<RegistrationDraft | null>(null);
  const [authBusy, setAuthBusy] = React.useState(false);
  const [user, setUser] = React.useState<User>(() => {
    const saved = localStorage.getItem('cerebrum_user');
    if(saved) try { return JSON.parse(saved) } catch {}
    return DEFAULT_USER;
  });
  const [balance, setBalance] = React.useState<number>(() => {
    const b = localStorage.getItem('cerebrum_balance');
    return b ? parseFloat(b) : 84.30;
  });
  const [view, setView] = React.useState<AppView>('dashboard');
  const [challengeIntent, setChallengeIntent] = React.useState<ChallengeComposerIntent | null>(null);
  const [claimedMissionIds, setClaimedMissionIds] = React.useState<string[]>(() => {
    const saved = localStorage.getItem('cerebrum_claimed_missions');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Game runner
  const [game, setGame] = React.useState<null | { id: GameId, stake: number, challenge?: Challenge }>(null);
  const [resultModal, setResultModal] = React.useState<null | { game: GameId, won:boolean, score:number, payout:number, msg?:string, stake:number }>(null);

  const [toasts, setToasts] = React.useState<{id:number, msg:string}[]>([]);
  const toast = (msg:string) => {
    const id = Date.now()+Math.random();
    setToasts(t=>[...t, {id, msg}]);
    setTimeout(()=> setToasts(t=>t.filter(x=>x.id!==id)), 2600);
  };

  React.useEffect(()=>{ localStorage.setItem('cerebrum_user', JSON.stringify(user)); }, [user]);
  React.useEffect(()=>{ localStorage.setItem('cerebrum_balance', String(balance)); }, [balance]);
  React.useEffect(()=>{ localStorage.setItem('cerebrum_claimed_missions', JSON.stringify(claimedMissionIds)); }, [claimedMissionIds]);
  const lastRemoteBalanceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (authState !== 'app' || !betaApi.isConfigured || !user.id || user.id === DEFAULT_USER.id) return;
    if (lastRemoteBalanceRef.current === balance) return;

    const syncHandle = window.setTimeout(() => {
      betaApi.setBalance(user.id, balance)
        .then((remoteBalance) => {
          lastRemoteBalanceRef.current = remoteBalance;
        })
        .catch(() => {
          // Keep the local app responsive even if the beta API is offline.
        });
    }, 250);

    return () => window.clearTimeout(syncHandle);
  }, [authState, balance, user.id]);

  React.useEffect(() => {
    if (authState !== 'app' || !betaApi.isConfigured || !user.id || user.id === DEFAULT_USER.id) return;

    let cancelled = false;
    betaApi.getBalance(user.id)
      .then((remoteBalance) => {
        if (cancelled) return;
        setBalance(remoteBalance);
        lastRemoteBalanceRef.current = remoteBalance;
      })
      .catch(() => {
        // Fall back to cached local balance if the beta API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [authState, user.id]);

  React.useEffect(() => {
    if (authState !== 'app' || !betaApi.isConfigured) return;
    const isDemoUser = user.id === DEFAULT_USER.id || user.email.endsWith('.test');
    if (!isDemoUser) return;

    localStorage.removeItem('cerebrum_auth');
    setAuthState('login');
    toast('Sign in or create a beta account to use the shared friend-test build.');
  }, [authState, user.email, user.id]);

  const finishAuth = React.useCallback((nextUser: User, nextBalance: number, message: string) => {
    setUser(nextUser);
    setBalance(nextBalance);
    setEmail(nextUser.email);
    lastRemoteBalanceRef.current = nextBalance;
    localStorage.setItem('cerebrum_auth','1');
    setAuthState('app');
    toast(message);
  }, []);

  const handleLogin = async ({ email: nextEmail, password }: { email: string; password: string }) => {
    setEmail(nextEmail);

    if (!betaApi.isConfigured) {
      localStorage.setItem('cerebrum_auth','1');
      setAuthState('app');
      toast('Welcome back.');
      return;
    }

    setAuthBusy(true);
    try {
      const session = await betaApi.login({ email: nextEmail, password });
      finishAuth(session.user, session.balance, `Welcome back, ${session.user.displayName}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegisterStart = React.useCallback((draft: RegistrationDraft) => {
    setEmail(draft.email);
    setRegistrationDraft(draft);
    setAuthState('verify');
  }, []);

  const handleRegistrationComplete = React.useCallback(async (profile: { displayName: string; avatar: string }) => {
    if (!registrationDraft || !betaApi.isConfigured) {
      setUser((current) => ({
        ...current,
        ...profile,
        email,
      }));
      localStorage.setItem('cerebrum_auth','1');
      setAuthState('app');
      toast('Account ready. Welcome credits added!');
      return;
    }

    setAuthBusy(true);
    try {
      const session = await betaApi.register({
        email: registrationDraft.email,
        username: registrationDraft.username,
        password: registrationDraft.password,
        displayName: profile.displayName,
        avatar: profile.avatar,
      });
      finishAuth(session.user, session.balance, 'Account ready. Welcome credits added!');
      setRegistrationDraft(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the account.';
      if (/already registered|already taken|complete every/i.test(message)) {
        setAuthState('register');
        toast(`${message} Update your details and try again.`);
      } else {
        toast(message);
      }
    } finally {
      setAuthBusy(false);
    }
  }, [email, finishAuth, registrationDraft]);

  const handleLogout = () => {
    localStorage.removeItem('cerebrum_auth');
    setAuthState('login');
    setView('dashboard');
  };

  const openChallengeFlow = React.useCallback((intent?: ChallengeComposerIntent) => {
    setChallengeIntent(intent ?? {});
    setView('challenges');
  }, []);

  const startGame = (id: GameId, stake = 0, challenge?: Challenge) => {
    if ((id === 'words' || id === 'scrabble') && !challenge) {
      openChallengeFlow({
        game: id,
        inviteScope: 'public',
        stake,
      });
      toast(id === 'words' ? 'Set up a WordForge quick play room, invite by username, or post and share it.' : 'Set up a Scrabble quick play table, invite by username, or post and share it.');
      return;
    }
    if (id === 'ludo' || id === 'whot' || id === 'chess') {
      setGame({ id, stake, challenge });
      return;
    }
    if (stake > 0 && balance < stake) { toast('Insufficient balance. Deposit first.'); setView('wallet'); return; }
    if (stake > 0) setBalance(b=>b-stake);
    setGame({ id, stake, challenge });
  };

  const lockLudoStake = (stakeToLock: number) => {
    if (stakeToLock <= 0) return true;
    if (balance < stakeToLock) {
      toast('Insufficient balance. Deposit first.');
      setView('wallet');
      return false;
    }
    setBalance((current) => current - stakeToLock);
    return true;
  };

  const creditBalance = (amount: number, message: string) => {
    if (amount <= 0) return;
    setBalance((current) => current + amount);
    toast(message);
  };

  const claimMission = React.useCallback((missionId: string, reward: number, title: string) => {
    if (claimedMissionIds.includes(missionId)) {
      toast('Reward already claimed.');
      return;
    }
    setClaimedMissionIds((current) => [...current, missionId]);
    creditBalance(reward, `${title} reward claimed: ${money(reward)} added.`);
  }, [claimedMissionIds, creditBalance]);

  const finishGame = (result:{score:number, won:boolean, payout:number, msg?:string, stake?:number}) => {
    if(!game) return;
    const payout = result.payout;
    if (payout > 0) setBalance(b=>b+payout);
    setResultModal({ game: game.id, ...result, stake: result.stake ?? game.stake });
    setGame(null);
  };

  const acceptChallenge = (c: Challenge) => {
    startGame(c.game, c.stake, c);
  };

  if (authState !== 'app') {
    let authScreen: React.ReactNode;
    if (authState === 'login') {
      authScreen = <LoginScreen onLogin={handleLogin} onGoRegister={()=>setAuthState('register')} busy={authBusy} />;
    } else if (authState === 'register') {
      authScreen = (
        <RegisterScreen
          onNext={handleRegisterStart}
          onGoLogin={()=>setAuthState('login')}
          busy={authBusy}
          initialValues={registrationDraft ?? undefined}
        />
      );
    } else if (authState === 'verify') {
      authScreen = <VerifyScreen email={email} onVerified={()=>setAuthState('onboard')} />;
    } else {
      authScreen = <OnboardScreen onDone={handleRegistrationComplete} busy={authBusy} />;
    }

    return (
      <>
        {authScreen}
        <ToastViewport toasts={toasts} />
      </>
    );
  }

  if (game) {
    return (
      <div className="app-safe-shell min-h-[100dvh] bg-[#f7f4ef] text-zinc-900 dark:bg-[#161310] dark:text-zinc-100" style={{fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif'}}>
        <div className="max-w-[1160px] mx-auto px-4 sm:px-8 lg:px-10 py-6">
          {game.id==='words' && <WordForge stake={game.stake} user={user} challenge={game.challenge} onExit={()=>setGame(null)} onFinish={finishGame} />}
          {game.id==='chess' && <ChessArena stake={game.stake} balance={balance} user={user} challenge={game.challenge} onLockStake={lockLudoStake} onExit={()=>setGame(null)} onFinish={finishGame} />}
          {game.id==='ludo' && <LudoRush stake={game.stake} balance={balance} user={user} challenge={game.challenge} onLockStake={lockLudoStake} onExit={()=>setGame(null)} onFinish={finishGame} />}
          {game.id==='whot' && <WhotArena stake={game.stake} balance={balance} user={user} challenge={game.challenge} onLockStake={lockLudoStake} onExit={()=>setGame(null)} onFinish={finishGame} />}
          {game.id==='scrabble' && <ScrabbleSocial stake={game.stake} user={user} challenge={game.challenge} onCreditRevealFee={creditBalance} onExit={()=>setGame(null)} onFinish={finishGame} />}
        </div>
        <ToastViewport toasts={toasts} />
      </div>
    );
  }

  return (
    <>
      <AppShell user={user} balance={balance} view={view} setView={setView} onLogout={handleLogout}>
        {view==='dashboard' && (
          <Dashboard
            user={user}
            balance={balance}
            onPlay={startGame}
            onChallenge={openChallengeFlow}
            onNavigate={setView}
            onClaimMission={claimMission}
            claimedMissionIds={claimedMissionIds}
          />
        )}
        {view==='challenges' && <ChallengeLobby user={user} onAccept={acceptChallenge} onBack={() => setView('dashboard')} toast={toast} launchIntent={challengeIntent} onLaunchIntentHandled={() => setChallengeIntent(null)} />}
        {view==='leaderboard' && <LeaderboardView />}
        {view==='wallet' && <WalletView balance={balance} setBalance={setBalance} toast={toast} />}
        {view==='profile' && <ProfileView user={user} onLogout={handleLogout} />}
      </AppShell>

      <Modal open={!!resultModal} onClose={()=>setResultModal(null)} title={resultModal?.won ? 'You won!' : resultModal?.msg?.includes('Draw') ? 'Draw' : 'Game finished'} maxWidth="max-w-md">
        {resultModal && (
          <div className="space-y-4">
            <Card className="p-4 bg-[#faf7f0] dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700">
              <div className="text-[13px] text-zinc-600 dark:text-zinc-400">
                {resultModal.game === 'words' ? 'WordForge' : resultModal.game === 'chess' ? 'Grandline Chess' : resultModal.game === 'ludo' ? 'Ludo Rush' : resultModal.game === 'scrabble' ? 'Scrabble Social' : 'Whot!'}
                {resultModal.stake > 0 ? ` • $${resultModal.stake.toFixed(2)} stake` : ' • Practice'}
              </div>
              <div className="mt-1 text-[15.5px]">{resultModal.msg || (resultModal.won ? 'Clean win. Payout settled.' : 'Tough one. Rematch?')}</div>
            </Card>
            <div className="grid grid-cols-3 text-center gap-3">
              <div><div className="text-[12px] text-zinc-500">Score</div><div className="text-[18px] font-[700]">{resultModal.score}</div></div>
              <div><div className="text-[12px] text-zinc-500">Stake</div><div className="text-[18px] font-[700]">{resultModal.stake ? money(resultModal.stake) : '—'}</div></div>
              <div><div className="text-[12px] text-zinc-500">Payout</div><div className="text-[18px] font-[700] text-emerald-700 dark:text-emerald-400">{resultModal.payout ? money(resultModal.payout) : '$0.00'}</div></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 justify-center" onClick={()=>{ const g=resultModal.game; const s=resultModal.stake; setResultModal(null); startGame(g,s); }}>Rematch</Button>
              <Button variant="soft" onClick={()=>setResultModal(null)} className="flex-1 justify-center">Back to Arena</Button>
            </div>
            <div className="text-[11.9px] text-zinc-500 text-center">Match ID {Math.random().toString(36).slice(2,9).toUpperCase()} • Verified • {new Date().toLocaleTimeString()}</div>
          </div>
        )}
      </Modal>

      <ToastViewport toasts={toasts} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Fragment+Mono:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); body { font-family: "Plus Jakarta Sans", system-ui, sans-serif; }`}</style>
    </>
  );
}
