import React from 'react';
import type { User, GameId, Challenge, MatchRecord } from './lib/types';
import {
  LoginScreen,
  RegisterScreen,
  VerifyScreen,
  OnboardScreen,
  ForgotPasswordRequestScreen,
  ResetPasswordScreen,
  type RegistrationInput,
} from './components/AuthScreens';
import { AppShell } from './components/Layout';
import { Dashboard, LeaderboardView } from './components/Dashboard';
import { ChallengeLobby } from './components/ChallengeLobby';
import { WalletView } from './components/WalletView';
import { ProfileView } from './components/ProfileView';
import { AdminDashboard } from './components/AdminDashboard';
import { WordForge } from './games/WordForge';
import { ChessArena } from './games/ChessArena';
import { LudoRush } from './games/LudoRush';
import { WhotArena } from './games/WhotArena';
import { ScrabbleSocial } from './games/ScrabbleSocial';
import { ToastViewport, Card, Button, Modal } from './components/ui';
import { money } from './lib/utils';
import { betaApi } from './lib/api';
import { DEFAULT_BETA_BALANCE, PRIMARY_COUNTRY } from './lib/market';

type AuthState = 'login' | 'register' | 'verify' | 'onboard' | 'recover-request' | 'recover-reset' | 'app';
type AppView = 'dashboard' | 'challenges' | 'leaderboard' | 'wallet' | 'profile' | 'admin';
type ChallengeComposerIntent = {
  game?: GameId;
  inviteScope?: 'public' | 'private';
  stake?: number;
  friendId?: string;
};

type RegistrationDraft = RegistrationInput;
const APP_BUILD_ID = '2026-07-16-auth-recovery-refresh-1';

function initializeBuildSession() {
  const previousBuild = localStorage.getItem('cerebrum_build');
  if (previousBuild === APP_BUILD_ID) return;

  localStorage.setItem('cerebrum_build', APP_BUILD_ID);
  localStorage.removeItem('cerebrum_auth');
  localStorage.removeItem('cerebrum_user');
  localStorage.removeItem('cerebrum_balance');
}

const DEFAULT_USER: User = {
  id: 'u_me',
  email: 'player@cerebrum.test',
  username: 'playerone',
  firstName: 'Demo',
  lastName: 'Player',
  phone: '+2348000000000',
  country: PRIMARY_COUNTRY,
  dateOfBirth: '1995-01-01',
  displayName: 'Player One',
  avatar: '🦊',
  rating: 1642,
  tier: 'Silver',
  joinedAt: new Date().toISOString(),
};

export default function App() {
  const [authState, setAuthState] = React.useState<AuthState>(() => {
    initializeBuildSession();
    const saved = localStorage.getItem('cerebrum_auth');
    return saved ? 'app' : 'login';
  });
  const [email, setEmail] = React.useState('player@cerebrum.test');
  const [loginIdentifier, setLoginIdentifier] = React.useState('');
  const [recoveryIdentifier, setRecoveryIdentifier] = React.useState('');
  const [registrationDraft, setRegistrationDraft] = React.useState<RegistrationDraft | null>(null);
  const [verificationToken, setVerificationToken] = React.useState<string | null>(null);
  const [authBusy, setAuthBusy] = React.useState(false);
  const [user, setUser] = React.useState<User>(() => {
    const saved = localStorage.getItem('cerebrum_user');
    if(saved) try { return { ...DEFAULT_USER, ...JSON.parse(saved) } } catch {}
    return DEFAULT_USER;
  });
  const [balance, setBalance] = React.useState<number>(() => {
    const b = localStorage.getItem('cerebrum_balance');
    return b ? parseFloat(b) : DEFAULT_BETA_BALANCE;
  });
  const [dataVersion, setDataVersion] = React.useState(0);
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
  const [game, setGame] = React.useState<null | { id: GameId, stake: number, challenge?: Challenge, watchOnly?: boolean }>(null);
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
  const bumpDataVersion = React.useCallback(() => {
    setDataVersion((current) => current + 1);
  }, []);

  const commitRemoteBalance = React.useCallback((nextBalance: number) => {
    setBalance(nextBalance);
    lastRemoteBalanceRef.current = nextBalance;
  }, []);

  React.useEffect(() => {
    if (authState !== 'app' || !betaApi.isConfigured || !user.id || user.id === DEFAULT_USER.id || !!game) return;
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
  }, [authState, balance, game, user.id]);

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

  React.useEffect(() => {
    if (authState !== 'app' || !betaApi.isConfigured || !user.id || user.id === DEFAULT_USER.id) return;

    let cancelled = false;
    betaApi.getProfile(user.id)
      .then((profile) => {
        if (cancelled) return;
        setUser(profile.user);
        setEmail(profile.user.email);
        commitRemoteBalance(profile.balance);
        bumpDataVersion();
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof Error && /user not found/i.test(error.message)) {
          localStorage.removeItem('cerebrum_auth');
          localStorage.removeItem('cerebrum_user');
          localStorage.removeItem('cerebrum_balance');
          setAuthState('login');
          setView('dashboard');
          toast('Your live beta account was reset on the server. Please sign in again or create the account again to continue.');
          return;
        }
        // Keep using the cached session if the live profile cannot be refreshed.
      });

    return () => {
      cancelled = true;
    };
  }, [authState, bumpDataVersion, commitRemoteBalance, user.id]);

  const finishAuth = React.useCallback((nextUser: User, nextBalance: number, message: string) => {
    setUser(nextUser);
    commitRemoteBalance(nextBalance);
    setEmail(nextUser.email);
    localStorage.setItem('cerebrum_auth','1');
    setAuthState('app');
    setView('dashboard');
    bumpDataVersion();
    toast(message);
  }, [bumpDataVersion, commitRemoteBalance]);

  const handleLogin = async ({ identifier, password }: { identifier: string; password: string }) => {
    const normalizedIdentifier = identifier.trim();
    setLoginIdentifier(normalizedIdentifier);
    if (normalizedIdentifier.includes('@')) {
      setEmail(normalizedIdentifier);
    }

    if (!betaApi.isConfigured) {
      localStorage.setItem('cerebrum_auth','1');
      setAuthState('app');
      toast('Welcome back.');
      return;
    }

    setAuthBusy(true);
    try {
      const session = await betaApi.login({ identifier: normalizedIdentifier, password });
      finishAuth(session.user, session.balance, `Welcome back, ${session.user.displayName}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setAuthBusy(false);
    }
  };

  const requestRegistrationEmailCode = React.useCallback(async (draft: RegistrationDraft, options?: { resend?: boolean }) => {
    setEmail(draft.email);
    setRegistrationDraft(draft);
    setVerificationToken(null);

    if (!betaApi.isConfigured) {
      setAuthState('verify');
      return true;
    }

    setAuthBusy(true);
    try {
      await betaApi.requestEmailCode({ email: draft.email, firstName: draft.firstName });
      setAuthState('verify');
      toast(
        options?.resend
          ? `A fresh 6-digit code was sent to ${draft.email}.`
          : `We sent a 6-digit code to ${draft.email}.`,
      );
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send a verification code.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleRegisterStart = React.useCallback((draft: RegistrationDraft) => {
    void requestRegistrationEmailCode(draft);
  }, [requestRegistrationEmailCode]);

  const handleOpenPasswordRecovery = React.useCallback((identifier: string) => {
    setRecoveryIdentifier(identifier.trim());
    setAuthState('recover-request');
  }, []);

  const handleRequestPasswordReset = React.useCallback(async (identifier: string, options?: { resend?: boolean }) => {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier) {
      toast('Enter your email or username first.');
      return false;
    }

    setRecoveryIdentifier(normalizedIdentifier);
    setLoginIdentifier(normalizedIdentifier);

    if (!betaApi.isConfigured) {
      toast('Password recovery needs the live server in this build.');
      return false;
    }

    setAuthBusy(true);
    try {
      await betaApi.requestPasswordResetCode({ identifier: normalizedIdentifier });
      setAuthState('recover-reset');
      toast(
        options?.resend
          ? 'A fresh password reset code has been sent.'
          : 'A password reset code has been sent to your account email.',
      );
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send a password reset code.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleResetPassword = React.useCallback(async ({
    code,
    newPassword,
    confirmPassword,
  }: {
    code: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!recoveryIdentifier) {
      setAuthState('recover-request');
      toast('Enter your email or username first.');
      return;
    }
    if (newPassword.length < 8) {
      toast('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Your password confirmation does not match.');
      return;
    }

    setAuthBusy(true);
    try {
      const session = await betaApi.resetPassword({
        identifier: recoveryIdentifier,
        code,
        newPassword,
      });
      finishAuth(session.user, session.balance, 'Password updated. You are signed in now.');
      setRecoveryIdentifier('');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not reset the password.');
    } finally {
      setAuthBusy(false);
    }
  }, [finishAuth, recoveryIdentifier]);

  const handleVerifyRegistrationEmail = React.useCallback(async (code: string) => {
    if (!registrationDraft) {
      setAuthState('register');
      return;
    }

    if (!betaApi.isConfigured) {
      setVerificationToken('local-preview');
      setAuthState('onboard');
      return;
    }

    setAuthBusy(true);
    try {
      const payload = await betaApi.verifyEmailCode({
        email: registrationDraft.email,
        code,
      });
      setVerificationToken(payload.verificationToken);
      setAuthState('onboard');
      toast('Email verified. Finish your player card to enter the arena.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not verify that code.');
    } finally {
      setAuthBusy(false);
    }
  }, [registrationDraft]);

  const handleRegistrationComplete = React.useCallback(async (profile: { displayName: string; avatar: string }) => {
    if (!registrationDraft || !betaApi.isConfigured) {
      setUser((current) => ({
        ...current,
        ...(registrationDraft ?? {}),
        ...profile,
      }));
      setEmail(registrationDraft?.email ?? email);
      localStorage.setItem('cerebrum_auth','1');
      setAuthState('app');
      setRegistrationDraft(null);
      setVerificationToken(null);
      toast('Account ready. Welcome credits added!');
      return;
    }

    if (!verificationToken) {
      setAuthState('verify');
      toast('Verify your email before finishing account setup.');
      return;
    }

    setAuthBusy(true);
    try {
      const session = await betaApi.register({
        firstName: registrationDraft.firstName,
        lastName: registrationDraft.lastName,
        email: registrationDraft.email,
        phone: registrationDraft.phone,
        country: registrationDraft.country,
        dateOfBirth: registrationDraft.dateOfBirth,
        username: registrationDraft.username,
        password: registrationDraft.password,
        displayName: profile.displayName,
        avatar: profile.avatar,
        referralCode: registrationDraft.referralCode,
        verificationToken,
      });
      finishAuth(session.user, session.balance, 'Account ready. Welcome credits added!');
      setRegistrationDraft(null);
      setVerificationToken(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the account.';
      if (/already registered|already taken|complete every/i.test(message)) {
        setAuthState('register');
        toast(`${message} Update your details and try again.`);
      } else if (/verify your email|verification expired/i.test(message)) {
        setVerificationToken(null);
        setAuthState('verify');
        toast(message);
      } else if (/live server|waking up|reach the live server/i.test(message)) {
        toast(`${message} Your player card is still saved here, so you can tap Enter the Arena again in a moment.`);
      } else {
        toast(message);
      }
    } finally {
      setAuthBusy(false);
    }
  }, [email, finishAuth, registrationDraft, verificationToken]);

  const handleLogout = () => {
    localStorage.removeItem('cerebrum_auth');
    setAuthState('login');
    setView('dashboard');
  };

  const openChallengeFlow = React.useCallback((intent?: ChallengeComposerIntent) => {
    setChallengeIntent(intent ?? {});
    setView('challenges');
  }, []);

  const startGame = (id: GameId, stake = 0, challenge?: Challenge, watchOnly = false) => {
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
      setGame({ id, stake, challenge, watchOnly });
      return;
    }
    if (stake > 0 && balance < stake) { toast('Insufficient balance. Fund your wallet first.'); setView('wallet'); return; }
    if (stake > 0) setBalance(b=>b-stake);
    setGame({ id, stake, challenge, watchOnly });
  };

  const lockLudoStake = (stakeToLock: number) => {
    if (stakeToLock <= 0) return true;
    if (balance < stakeToLock) {
      toast('Insufficient balance. Fund your wallet first.');
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
    const completedGame = game;
    const stake = result.stake ?? completedGame.stake;
    const payout = Number((result.payout ?? 0).toFixed(2));
    const closingBalance = Number((balance + payout).toFixed(2));
    const lowerMessage = result.msg?.toLowerCase() ?? '';
    const matchResult: MatchRecord['result'] = result.won ? 'win' : lowerMessage.includes('draw') ? 'draw' : 'loss';
    const opponentFromParticipants = completedGame.challenge?.participants?.find((participant) => participant.id !== user.id);
    const opponent = opponentFromParticipants
      ? { name: opponentFromParticipants.name, avatar: opponentFromParticipants.avatar }
      : completedGame.challenge?.creator.id && completedGame.challenge.creator.id !== user.id
        ? { name: completedGame.challenge.creator.name, avatar: completedGame.challenge.creator.avatar }
        : {
            name: completedGame.challenge ? 'Arena rival' : 'Computer',
            avatar: completedGame.challenge ? '🎯' : '🤖',
          };

    if (payout > 0) {
      commitRemoteBalance(closingBalance);
    }

    if (betaApi.isConfigured && user.id !== DEFAULT_USER.id) {
      betaApi.recordMatch({
        userId: user.id,
        game: completedGame.id,
        result: matchResult,
        score: String(result.score),
        stake,
        payout,
        opponentName: opponent.name,
        opponentAvatar: opponent.avatar,
        closingBalance,
      })
        .then((remoteBalance) => {
          commitRemoteBalance(remoteBalance);
          bumpDataVersion();
        })
        .catch(() => {
          toast('Match finished, but live stat sync could not be confirmed.');
        });
    }

    setResultModal({ game: completedGame.id, ...result, payout, stake });
    setGame(null);
  };

  const acceptChallenge = (c: Challenge) => {
    startGame(c.game, c.stake, c);
  };

  const watchChallenge = (c: Challenge) => {
    startGame(c.game, c.stake, c, true);
  };

  if (authState !== 'app') {
    let authScreen: React.ReactNode;
    const suggestedDisplayName = registrationDraft
      ? `${registrationDraft.firstName.trim()}${registrationDraft.lastName.trim() ? ` ${registrationDraft.lastName.trim().charAt(0)}.` : ''}`.trim()
      : undefined;
    if (authState === 'login') {
      authScreen = (
        <LoginScreen
          onLogin={handleLogin}
          onGoRegister={()=>setAuthState('register')}
          onGoForgotPassword={handleOpenPasswordRecovery}
          busy={authBusy}
          initialIdentifier={loginIdentifier}
          showDemo={!betaApi.isConfigured}
        />
      );
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
      authScreen = registrationDraft
        ? (
          <VerifyScreen
            draft={registrationDraft}
            emailVerificationRequired={betaApi.isConfigured}
            busy={authBusy}
            onVerified={(code) => { void handleVerifyRegistrationEmail(code); }}
            onResend={() => { void requestRegistrationEmailCode(registrationDraft, { resend: true }); }}
            onBack={() => {
              setVerificationToken(null);
              setAuthState('register');
            }}
          />
        )
        : (
          <RegisterScreen
            onNext={handleRegisterStart}
            onGoLogin={()=>setAuthState('login')}
            busy={authBusy}
          />
        );
    } else if (authState === 'recover-request') {
      authScreen = (
        <ForgotPasswordRequestScreen
          busy={authBusy}
          initialIdentifier={recoveryIdentifier || loginIdentifier}
          onSendCode={(identifier) => { void handleRequestPasswordReset(identifier); }}
          onBack={() => setAuthState('login')}
        />
      );
    } else if (authState === 'recover-reset') {
      authScreen = (
        <ResetPasswordScreen
          busy={authBusy}
          identifier={recoveryIdentifier}
          onReset={(payload) => { void handleResetPassword(payload); }}
          onResend={() => { void handleRequestPasswordReset(recoveryIdentifier, { resend: true }); }}
          onBack={() => setAuthState('login')}
        />
      );
    } else {
      authScreen = <OnboardScreen onDone={handleRegistrationComplete} busy={authBusy} initialDisplayName={suggestedDisplayName} />;
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
      <div className="app-safe-shell min-h-[100dvh] bg-transparent text-white">
        <div className="mx-auto max-w-[1160px] px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
          {game.id==='words' && <WordForge stake={game.stake} user={user} challenge={game.challenge} onExit={()=>setGame(null)} onFinish={finishGame} />}
          {game.id==='chess' && <ChessArena stake={game.stake} balance={balance} user={user} challenge={game.challenge} onLockStake={lockLudoStake} onExit={()=>setGame(null)} onFinish={finishGame} />}
          {game.id==='ludo' && <LudoRush stake={game.stake} balance={balance} user={user} challenge={game.challenge} watchOnly={game.watchOnly} onLockStake={lockLudoStake} onExit={()=>setGame(null)} onFinish={finishGame} />}
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
        {view==='challenges' && <ChallengeLobby user={user} onAccept={acceptChallenge} onWatch={watchChallenge} onBack={() => setView('dashboard')} toast={toast} launchIntent={challengeIntent} onLaunchIntentHandled={() => setChallengeIntent(null)} />}
        {view==='leaderboard' && <LeaderboardView user={user} toast={toast} onOpenChallenge={acceptChallenge} onWatchChallenge={watchChallenge} />}
        {view==='wallet' && <WalletView user={user} balance={balance} setBalance={commitRemoteBalance} toast={toast} refreshKey={dataVersion} onRemoteMutation={bumpDataVersion} onUserChange={setUser} />}
        {view==='profile' && (
          <ProfileView
            user={user}
            balance={balance}
            toast={toast}
            refreshKey={dataVersion}
            onLogout={handleLogout}
            onUserChange={setUser}
          />
        )}
        {view==='admin' && <AdminDashboard user={user} refreshKey={dataVersion} />}
      </AppShell>

      <Modal open={!!resultModal} onClose={()=>setResultModal(null)} title="Match result" maxWidth="max-w-md">
        {resultModal && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                {resultModal.game === 'words' ? 'WordForge' : resultModal.game === 'chess' ? 'Grandline Chess' : resultModal.game === 'ludo' ? 'Ludo Rush' : resultModal.game === 'scrabble' ? 'Scrabble Social' : 'Whot Arena'}
              </div>
              <div className="mt-3 text-[2.35rem] font-[800] leading-[0.92] tracking-[-0.07em] text-white">
                {resultModal.won ? 'YOU WON' : resultModal.msg?.includes('Draw') ? 'DRAW' : 'MATCH COMPLETE'}
              </div>
              <div className="mt-3 text-[15px] text-[var(--muted)]">
                {resultModal.msg || (resultModal.won ? 'Clean win. Payout settled.' : 'Tough one. Rematch?')}
              </div>
            </div>

            <Card className="bg-[linear-gradient(135deg,rgba(122,84,239,0.2),rgba(18,24,37,0.92))] p-5">
              <div className="text-[12px] uppercase tracking-[0.2em] text-[var(--muted)]">Payout settled</div>
              <div className="mt-3 text-[3rem] font-[800] leading-none tracking-[-0.08em] text-[var(--lime)]">
                {resultModal.payout ? money(resultModal.payout) : money(0)}
              </div>
              <div className="mt-3 text-[13px] text-slate-300">
                {resultModal.stake > 0 ? `${money(resultModal.stake)} stake table` : 'Practice table'} • Verified finish
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <Card className="p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Score</div>
                <div className="mt-2 text-[1.35rem] font-[800] tracking-[-0.04em]">{resultModal.score}</div>
              </Card>
              <Card className="p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Stake</div>
                <div className="mt-2 text-[1.35rem] font-[800] tracking-[-0.04em]">{resultModal.stake ? money(resultModal.stake) : '—'}</div>
              </Card>
              <Card className="p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Result</div>
                <div className="mt-2 text-[1.1rem] font-[800] tracking-[-0.04em] text-[var(--lime)]">
                  {resultModal.won ? 'WIN' : resultModal.msg?.includes('Draw') ? 'DRAW' : 'LOSS'}
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button className="flex-1 justify-center" onClick={()=>{ const g=resultModal.game; const s=resultModal.stake; setResultModal(null); startGame(g,s); }}>
                Rematch
              </Button>
              <Button variant="secondary" onClick={()=>setResultModal(null)} className="flex-1 justify-center">
                Back to Arena
              </Button>
            </div>
            <div className="text-center text-[11.9px] text-[var(--muted)]">
              Match ID {Math.random().toString(36).slice(2,9).toUpperCase()} • Verified • {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}
      </Modal>

      <ToastViewport toasts={toasts} />
    </>
  );
}
