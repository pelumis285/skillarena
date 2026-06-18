import React from 'react';
import { AVATARS } from '../lib/mock';
import { Button, Field } from './ui';

export function AuthShell({ children, side }: { children: React.ReactNode, side?: React.ReactNode }) {
  return (
    <div className="app-safe-shell min-h-[100dvh] bg-[#f6f3ee] text-zinc-900 dark:bg-[#151210] dark:text-zinc-100" style={{fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif'}}>
      <div className="max-w-6xl mx-auto px-5 sm:px-10 lg:px-12 py-12 lg:py-20 grid lg:grid-cols-[1.06fr_.94fr] gap-12 items-center">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#191818] text-white dark:bg-amber-50 dark:text-zinc-900 grid place-items-center font-[800] text-[16px]">C</div>
            <div className="text-[19px] font-[750] tracking-tight">cerebrum</div>
            <span className="text-[11px] text-zinc-500">Skill Arena</span>
          </div>
          {children}
        </div>
        <div className="hidden lg:block">
          {side || <AuthPromo/>}
        </div>
      </div>
    </div>
  );
}

function AuthPromo() {
  return (
    <div className="rounded-[34px] bg-[#12100e] text-[#f5f1ea] dark:bg-zinc-900 p-10 min-h-[560px] relative overflow-hidden shadow-2xl">
      <div className="text-[13px] uppercase tracking-wider text-[#d8cfc2]">Live arena</div>
      <div className="mt-4 text-[46px] leading-[0.98] tracking-[-0.028em]" style={{fontFamily:'Fraunces, serif'}}>
        Play classic skill<br/>games for real stakes.<br/>Win clean.
      </div>
      <div className="mt-5 text-[15px] text-[#d5ccc0] max-w-sm">Words • Chess • Ludo. Peer-to-peer challenges, escrowed pots, instant payouts. 7% platform rake.</div>
      <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
        {[
          {k:'4.2k', l:'Daily matches'},
          {k:'$186k', l:'Paid out'},
          {k:'98.4%', l:'Fair play'},
        ].map(b=>(
          <div key={b.l} className="rounded-[18px] bg-white/6 border border-white/10 px-4 py-4">
            <div className="text-[22px] font-[700] tracking-tight">{b.k}</div>
            <div className="text-[#d2c7b8] text-[12.5px]">{b.l}</div>
          </div>
        ))}
      </div>
      <div className="absolute -right-10 -bottom-14 opacity-[.16] text-[220px]">♞</div>
    </div>
  );
}

export function LoginScreen({
  onLogin,
  onGoRegister,
  busy = false,
}: {
  onLogin:(credentials:{ email: string; password: string })=>void,
  onGoRegister: ()=>void,
  busy?: boolean,
}) {
  const [email,setEmail] = React.useState('player@cerebrum.test');
  const [pw,setPw] = React.useState('password');
  return (
    <AuthShell>
      <h1 className="text-[44px] sm:text-[53px] leading-[0.97] tracking-[-0.028em] font-[650]" style={{fontFamily:'Fraunces, serif'}}>Welcome back to the parlor.</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-md">Log in to challenge, stake, and collect. Funds are held in escrow until results are verified.</p>
      <div className="mt-8 max-w-md space-y-4">
        <Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com"/>
        <Field label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
        <Button className="w-full py-3.5 text-[15px]" onClick={()=>onLogin({ email, password: pw })} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">New to Cerebrum? <button onClick={onGoRegister} className="underline underline-offset-4">Create account</button></div>
      </div>
      <div className="mt-6 text-[11.8px] text-zinc-500">If the beta backend is running, this signs into the real shared test app. Otherwise it falls back to local demo mode.</div>
    </AuthShell>
  )
}

export function RegisterScreen({
  onNext,
  onGoLogin,
  busy = false,
  initialValues,
}: {
  onNext:(payload:{ email: string; username: string; password: string; referralCode?: string })=>void,
  onGoLogin:()=>void,
  busy?: boolean,
  initialValues?: { email?: string; username?: string; password?: string; referralCode?: string },
}) {
  const [email,setEmail]=React.useState(initialValues?.email ?? '');
  const [username,setUsername]=React.useState(initialValues?.username ?? '');
  const [pw,setPw]=React.useState(initialValues?.password ?? '');
  const [referralCode, setReferralCode] = React.useState(initialValues?.referralCode ?? '');

  React.useEffect(() => {
    setEmail(initialValues?.email ?? '');
    setUsername(initialValues?.username ?? '');
    setPw(initialValues?.password ?? '');
    setReferralCode(initialValues?.referralCode ?? '');
  }, [initialValues?.email, initialValues?.password, initialValues?.referralCode, initialValues?.username]);

  return (
    <AuthShell>
      <h1 className="text-[44px] sm:text-[53px] leading-[0.97] tracking-[-0.028em] font-[650]" style={{fontFamily:'Fraunces, serif'}}>Create your player account</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-md">Takes 45 seconds. Secure Stripe payouts, instant matchmaking.</p>
      <div className="mt-7 max-w-md space-y-4">
        <Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com"/>
        <Field label="Username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="chesscat" />
        <Field label="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Min 8 characters"/>
        <Field label="Referral code (optional)" value={referralCode} onChange={e=>setReferralCode(e.target.value.toUpperCase())} placeholder="FRIEND1234" />
        <Button
          className="w-full py-3.5 text-[15px]"
          onClick={()=>onNext({
            email: email || 'new@cerebrum.test',
            username: username || 'newplayer',
            password: pw || 'password',
            referralCode: referralCode.trim() || undefined,
          })}
          disabled={busy}
        >
          {busy ? 'Saving…' : 'Continue'}
        </Button>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Already have an account? <button type="button" onClick={onGoLogin} className="underline underline-offset-4">Sign in</button></div>
        <div className="text-[11.5px] text-zinc-500">By creating an account you agree to our fair-play policy and 18+ skill-gaming terms.</div>
      </div>
    </AuthShell>
  )
}

export function VerifyScreen({ email, onVerified }: { email:string, onVerified:()=>void }) {
  const [code,setCode] = React.useState(['','','','','','']);
  const inputs = React.useRef<Array<HTMLInputElement|null>>([]);
  const setDigit = (idx:number,v:string) => {
    if(!/^\d?$/.test(v)) return;
    const n=[...code]; n[idx]=v; setCode(n);
    if(v && idx<5) inputs.current[idx+1]?.focus();
  };
  const full = code.join('');
  return (
    <AuthShell>
      <h1 className="text-[44px] sm:text-[53px] leading-[0.97] tracking-[-0.028em] font-[650]" style={{fontFamily:'Fraunces, serif'}}>Check your email</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-md">We sent a 6-digit verification code to <b>{email}</b>. Enter it below.</p>
      <div className="mt-7 flex gap-2">
        {code.map((d,i)=>(
          <input key={i} ref={el=> { inputs.current[i]=el }} value={d} onChange={e=>setDigit(i,e.target.value)} className="w-12 h-14 text-center rounded-[16px] bg-[#f2efe9] border border-zinc-200 text-[22px] font-[650] focus:outline-none focus:ring-2 focus:ring-amber-400 dark:bg-zinc-800 dark:border-zinc-700"/>
        ))}
      </div>
      <div className="mt-5 flex gap-3">
        <Button disabled={full.length!==6} onClick={onVerified}>Verify & continue</Button>
        <Button variant="soft" onClick={onVerified}>Paste demo code</Button>
      </div>
      <div className="mt-3 text-[12.7px] text-zinc-500">Demo: any 6 digits will work.</div>
    </AuthShell>
  )
}

export function OnboardScreen({
  onDone,
  busy = false,
}:{
  onDone:(profile:{displayName:string, avatar:string})=>void,
  busy?: boolean,
}) {
  const [displayName,setDisplayName] = React.useState('Archer');
  const [avatar,setAvatar] = React.useState(AVATARS[0]);
  return (
    <AuthShell side={
      <div className="rounded-[34px] bg-[#f1ebe3] text-zinc-900 p-10 min-h-[560px] dark:bg-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        <div className="text-[13px] uppercase tracking-wider text-zinc-500">Profile</div>
        <div className="mt-16 flex flex-col items-center">
          <div className="text-[86px]">{avatar}</div>
          <div className="mt-3 text-[26px] font-[720]" style={{fontFamily:'Fraunces, serif'}}>{displayName || 'Your name'}</div>
          <div className="text-zinc-600 dark:text-zinc-400">Starting tier • Bronze III</div>
        </div>
      </div>
    }>
      <h1 className="text-[44px] sm:text-[53px] leading-[0.97] tracking-[-0.028em] font-[650]" style={{fontFamily:'Fraunces, serif'}}>Set up your player card</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-md">This is how opponents will see you in the Arena.</p>
      <div className="mt-7 max-w-md space-y-5">
        <Field label="Display name" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your display name"/>
        <div>
          <div className="text-zinc-600 mb-2 font-[550] text-[12.8px] dark:text-zinc-400">Choose an avatar</div>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map(a=>(
              <button type="button" key={a} onClick={()=>setAvatar(a)} className={"text-[24px] rounded-2xl h-12 bg-[#f2efe9] border transition dark:bg-zinc-800 " + (avatar===a ? 'border-zinc-900 dark:border-amber-300 scale-[1.04]' : 'border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-700/80')}>{a}</button>
            ))}
          </div>
        </div>
        <Button className="w-full py-3.5 text-[15px]" onClick={()=>onDone({displayName, avatar})} disabled={busy}>
          {busy ? 'Entering…' : 'Enter the Arena'}
        </Button>
        <div className="text-[12px] text-zinc-500">You’ll start with $25 welcome credits.</div>
      </div>
    </AuthShell>
  )
}
