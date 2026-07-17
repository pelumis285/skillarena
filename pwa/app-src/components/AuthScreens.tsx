import React from 'react';
import { AVATARS } from '../lib/mock';
import { PRIMARY_COUNTRY } from '../lib/market';
import { Button, Field, GlassCard, Pill } from './ui';

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  dateOfBirth: string;
  username: string;
  password: string;
  referralCode?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function normalizeRegistrationInput(input: RegistrationInput): RegistrationInput {
  return {
    firstName: input.firstName.trim().replace(/\s+/g, ' '),
    lastName: input.lastName.trim().replace(/\s+/g, ' '),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    country: input.country.trim(),
    dateOfBirth: input.dateOfBirth.trim(),
    username: input.username.trim().toLowerCase(),
    password: input.password.trim(),
    referralCode: input.referralCode?.trim().toUpperCase() || undefined,
  };
}

function getAge(dateOfBirth: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - parsed.getUTCMonth();
  const dayDelta = today.getUTCDate() - parsed.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age;
}

function validateRegistrationInput(input: RegistrationInput) {
  if (input.firstName.length < 2) return 'Enter your first name.';
  if (input.lastName.length < 2) return 'Enter your last name.';
  if (!EMAIL_PATTERN.test(input.email)) return 'Enter a valid email address.';

  const phoneDigits = input.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Enter a working phone number.';

  if (input.country.length < 2) return 'Enter your country or region.';

  const age = getAge(input.dateOfBirth);
  if (age === null) return 'Choose a valid date of birth.';
  if (age < 18) return 'You must be at least 18 years old to register.';

  if (!USERNAME_PATTERN.test(input.username)) {
    return 'Username must be 3-20 characters using letters, numbers, or underscores.';
  }

  if (input.password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-safe-shell min-h-[100dvh] bg-transparent text-[var(--text)]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-[1.4rem] bg-[var(--lime)] text-[28px] font-[800] text-[#0a0f18] sm:h-16 sm:w-16 sm:rounded-[1.65rem] sm:text-[32px]">
            C
          </div>
          <div className="text-[28px] font-[800] tracking-[-0.04em] text-[var(--text)] sm:text-[32px]">cerebrum</div>
        </div>
        <div className="pt-10 sm:pt-14">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginScreen({
  onLogin,
  onGoRegister,
  onGoForgotPassword,
  busy = false,
  initialIdentifier = '',
  showDemo = false,
}: {
  onLogin:(credentials:{ identifier: string; password: string })=>void,
  onGoRegister: ()=>void,
  onGoForgotPassword: (identifier: string)=>void,
  busy?: boolean,
  initialIdentifier?: string,
  showDemo?: boolean,
}) {
  const [identifier, setIdentifier] = React.useState(initialIdentifier);
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    setIdentifier(initialIdentifier);
  }, [initialIdentifier]);

  return (
    <AuthShell>
      <div className="skill-wordmark">CEREBRUM</div>
      <h1 className="mt-6 skill-screen-title">Welcome back</h1>
      <p className="mt-3 skill-screen-subtitle">Sign in with your real email or username to continue to your arena.</p>

      <div className="mt-12 space-y-8">
        <Field label="Email or username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="player@email.com or samuel285" autoComplete="username" />
        <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" />

        <Button size="lg" fullWidth onClick={() => onLogin({ identifier, password })} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="text-center">
          <button type="button" onClick={() => onGoForgotPassword(identifier)} className="text-[16px] font-[700] text-[var(--lime)]">
            Forgot password?
          </button>
        </div>

        <GlassCard className="rounded-[1.9rem] border-white/8 bg-white/[0.05] p-5 text-left">
          <div className="text-[16px] font-[800] tracking-[-0.03em] text-white">Sign-in tips</div>
          <div className="mt-3 text-[15px] text-slate-300">Use the same email or username you registered with. If your account is not in the server yet, create it again or reset the password once SMTP is configured.</div>
        </GlassCard>

        {showDemo ? (
          <Button variant="secondary" size="lg" fullWidth onClick={() => onLogin({ identifier: 'player@cerebrum.test', password: 'password' })}>
            Enter demo arena
          </Button>
        ) : null}
      </div>

      <button type="button" onClick={onGoRegister} className="mt-12 block w-full text-center text-[18px] font-[700] text-[var(--lime)]">
        New player? Create an account
      </button>
    </AuthShell>
  );
}

export function ForgotPasswordRequestScreen({
  onBack,
  onSendCode,
  busy = false,
  initialIdentifier = '',
}: {
  onBack: ()=>void;
  onSendCode: (identifier: string)=>void;
  busy?: boolean;
  initialIdentifier?: string;
}) {
  const [identifier, setIdentifier] = React.useState(initialIdentifier);

  React.useEffect(() => {
    setIdentifier(initialIdentifier);
  }, [initialIdentifier]);

  return (
    <AuthShell>
      <div className="skill-wordmark">CEREBRUM</div>
      <h1 className="mt-6 skill-screen-title">Reset your password</h1>
      <p className="mt-3 skill-screen-subtitle">Enter the email or username tied to your player account and we’ll send a 6-digit recovery code.</p>

      <div className="mt-10 space-y-6">
        <Field label="Email or username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="player@email.com or samuel285" autoComplete="username" />

        <Button size="lg" fullWidth onClick={() => onSendCode(identifier)} disabled={busy}>
          {busy ? 'Sending code…' : 'Send reset code'}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>Back to sign in</Button>
      </div>
    </AuthShell>
  );
}

export function ResetPasswordScreen({
  identifier,
  onBack,
  onResend,
  onReset,
  busy = false,
}: {
  identifier: string;
  onBack: ()=>void;
  onResend: ()=>void;
  onReset: (payload: { code: string; newPassword: string; confirmPassword: string })=>void;
  busy?: boolean;
}) {
  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  React.useEffect(() => {
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
  }, [identifier]);

  return (
    <AuthShell>
      <div className="skill-wordmark">CEREBRUM</div>
      <h1 className="mt-6 skill-screen-title">Choose a new password</h1>
      <p className="mt-3 skill-screen-subtitle">Enter the 6-digit code sent to the account behind <span className="font-[700] text-white">{identifier}</span>, then set a new password.</p>

      <div className="mt-10 space-y-6">
        <Field
          label="Reset code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
        />
        <Field label="New password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
        <Field label="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat the new password" autoComplete="new-password" />

        <Button size="lg" fullWidth onClick={() => onReset({ code, newPassword, confirmPassword })} disabled={busy}>
          {busy ? 'Resetting…' : 'Reset password and sign in'}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onResend} disabled={busy}>Resend code</Button>
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>Back to sign in</Button>
      </div>
    </AuthShell>
  );
}

export function RegisterScreen({
  onNext,
  onGoLogin,
  busy = false,
  initialValues,
}: {
  onNext:(payload: RegistrationInput)=>void,
  onGoLogin:()=>void,
  busy?: boolean,
  initialValues?: Partial<RegistrationInput>,
}) {
  const [firstName, setFirstName] = React.useState(initialValues?.firstName ?? '');
  const [lastName, setLastName] = React.useState(initialValues?.lastName ?? '');
  const [email, setEmail] = React.useState(initialValues?.email ?? '');
  const [phone, setPhone] = React.useState(initialValues?.phone ?? '');
  const [country, setCountry] = React.useState(initialValues?.country ?? PRIMARY_COUNTRY);
  const [dateOfBirth, setDateOfBirth] = React.useState(initialValues?.dateOfBirth ?? '');
  const [username, setUsername] = React.useState(initialValues?.username ?? '');
  const [password, setPassword] = React.useState(initialValues?.password ?? '');
  const [referralCode, setReferralCode] = React.useState(initialValues?.referralCode ?? '');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFirstName(initialValues?.firstName ?? '');
    setLastName(initialValues?.lastName ?? '');
    setEmail(initialValues?.email ?? '');
    setPhone(initialValues?.phone ?? '');
    setCountry(initialValues?.country ?? PRIMARY_COUNTRY);
    setDateOfBirth(initialValues?.dateOfBirth ?? '');
    setUsername(initialValues?.username ?? '');
    setPassword(initialValues?.password ?? '');
    setReferralCode(initialValues?.referralCode ?? '');
    setError(null);
  }, [
    initialValues?.country,
    initialValues?.dateOfBirth,
    initialValues?.email,
    initialValues?.firstName,
    initialValues?.lastName,
    initialValues?.password,
    initialValues?.phone,
    initialValues?.referralCode,
    initialValues?.username,
  ]);

  const handleContinue = () => {
    const nextPayload = normalizeRegistrationInput({
      firstName,
      lastName,
      email,
      phone,
      country,
      dateOfBirth,
      username,
      password,
      referralCode,
    });
    const validationError = validateRegistrationInput(nextPayload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onNext(nextPayload);
  };

  return (
    <AuthShell>
      <div className="skill-wordmark">CEREBRUM</div>
      <h1 className="mt-6 skill-screen-title">Create your player account</h1>
      <p className="mt-3 skill-screen-subtitle">Use real account details so payouts, recovery, and referrals are tied to the right player.</p>

      <GlassCard className="mt-8 rounded-[1.8rem] border-white/10 bg-white/[0.05] p-4 text-[13px] text-slate-300">
        Your legal name, phone, country, and date of birth help protect balances, referrals, and future withdrawals.
      </GlassCard>

      <div className="mt-8 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Samuel" autoComplete="given-name" />
          <Field label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Oluwapelumi" autoComplete="family-name" />
        </div>

        <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="player@email.com" autoComplete="email" />

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Phone number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+234 801 234 5678" autoComplete="tel" />
          <Field label="Country / region" value={country} onChange={(event) => setCountry(event.target.value)} placeholder={PRIMARY_COUNTRY} autoComplete="country-name" />
        </div>

        <Field label="Date of birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="samuel285" autoComplete="username" />
          <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" autoComplete="new-password" />
        </div>

        <Field label="Referral code" value={referralCode} onChange={(event) => setReferralCode(event.target.value.toUpperCase())} placeholder="Optional" />

        {error && (
          <GlassCard className="rounded-[1.7rem] border-[#5e1f2a] bg-[#4e1823] p-4 text-[14px] text-[#f0d5da]">
            {error}
          </GlassCard>
        )}

        <Button
          size="lg"
          fullWidth
          disabled={busy}
          onClick={handleContinue}
        >
          {busy ? 'Saving…' : 'Review details'}
        </Button>
      </div>

      <div className="mt-10 text-center text-[16px] text-[var(--muted)]">
        Already have an account?{' '}
        <button type="button" onClick={onGoLogin} className="font-[700] text-[var(--lime)]">
          Sign in
        </button>
      </div>
    </AuthShell>
  );
}

export function VerifyScreen({
  draft,
  onVerified,
  onResend,
  onBack,
  busy = false,
  emailVerificationRequired = true,
}: {
  draft: RegistrationInput;
  onVerified:(code: string)=>void;
  onResend:()=>void;
  onBack:()=>void;
  busy?: boolean;
  emailVerificationRequired?: boolean;
}) {
  const legalName = [draft.firstName, draft.lastName].filter(Boolean).join(' ');
  const [code, setCode] = React.useState('');

  React.useEffect(() => {
    setCode('');
  }, [draft.email]);

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
  return (
    <AuthShell>
      <div className="skill-wordmark">CEREBRUM</div>
      <h1 className="mt-6 skill-screen-title">{emailVerificationRequired ? 'Verify your email' : 'Review your account'}</h1>
      <p className="mt-3 skill-screen-subtitle">
        {emailVerificationRequired
          ? `We sent a 6-digit code to ${draft.email}. Enter it here before you build your player card.`
          : 'Make sure these signup details are correct before you build your player card.'}
      </p>

      <GlassCard className="mt-10 rounded-[2rem] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Legal name', value: legalName },
            { label: 'Email', value: draft.email },
            { label: 'Phone', value: draft.phone },
            { label: 'Country', value: draft.country },
            { label: 'Date of birth', value: draft.dateOfBirth },
            { label: 'Username', value: `@${draft.username}` },
          ].map((row) => (
            <div key={row.label} className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{row.label}</div>
              <div className="mt-2 text-[15px] font-[760] text-white">{row.value}</div>
            </div>
          ))}
          {draft.referralCode && (
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4 sm:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Referral code</div>
              <div className="mt-2 text-[15px] font-[760] text-white">{draft.referralCode}</div>
            </div>
          )}
        </div>
        <div className="mt-5 text-[13px] text-slate-300">
          {emailVerificationRequired
            ? 'We use your verified email for account recovery, security checks, payouts, and referral support.'
            : 'We use these details for account recovery, fair-play checks, payouts, and referral support.'}
        </div>
      </GlassCard>

      {emailVerificationRequired && (
        <div className="mt-8 space-y-4">
          <Field
            label="Verification code"
            value={normalizedCode}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && normalizedCode.length === 6 && !busy) {
                event.preventDefault();
                onVerified(normalizedCode);
              }
            }}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
          />
        </div>
      )}

      <div className="mt-8 space-y-3">
        <Button
          size="lg"
          fullWidth
          disabled={busy || (emailVerificationRequired && normalizedCode.length !== 6)}
          onClick={() => onVerified(normalizedCode)}
        >
          {busy
            ? (emailVerificationRequired ? 'Checking code…' : 'Saving…')
            : (emailVerificationRequired ? 'Verify & continue' : 'Continue to player card')}
        </Button>
        {emailVerificationRequired && (
          <Button variant="secondary" size="lg" fullWidth disabled={busy} onClick={onResend}>
            Resend code
          </Button>
        )}
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>Edit details</Button>
      </div>
    </AuthShell>
  );
}

export function OnboardScreen({
  onDone,
  busy = false,
  initialDisplayName,
}:{
  onDone:(profile:{displayName:string, avatar:string})=>void,
  busy?: boolean,
  initialDisplayName?: string,
}) {
  const [displayName, setDisplayName] = React.useState(initialDisplayName ?? 'Samuel A.');
  const [avatar, setAvatar] = React.useState(AVATARS[0]);
  const interestPills = [
    { label: 'Words', className: 'bg-[var(--purple)] text-white' },
    { label: 'Chess', className: 'bg-[var(--blue)] text-white' },
    { label: 'Ludo', className: 'bg-[var(--orange)] text-white' },
  ];

  React.useEffect(() => {
    setDisplayName(initialDisplayName ?? 'Samuel A.');
  }, [initialDisplayName]);

  return (
    <AuthShell>
      <div className="skill-wordmark">CEREBRUM</div>
      <h1 className="mt-6 skill-screen-title">Build your player card</h1>
      <p className="mt-3 skill-screen-subtitle">This is how opponents will see you.</p>

      <div className="mt-12">
        <div className="mb-4 text-[18px] font-[700] text-[var(--muted)]">Choose an avatar</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {AVATARS.slice(0, 4).map((entry) => (
            <button
              type="button"
              key={entry}
              onClick={() => setAvatar(entry)}
              className={entry === avatar ? 'grid h-28 place-items-center rounded-[1.6rem] bg-[var(--lime)] text-[50px] sm:h-36 sm:rounded-[2rem] sm:text-[58px]' : 'grid h-28 place-items-center rounded-[1.6rem] bg-[var(--surface-2)] text-[44px] sm:h-36 sm:rounded-[2rem] sm:text-[52px]'}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Field label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Samuel A." />
      </div>

      <div className="mt-10">
        <div className="mb-4 text-[18px] font-[700] text-[var(--muted)]">Skill interests</div>
        <div className="flex flex-wrap gap-4">
          {interestPills.map((pill) => (
            <Pill key={pill.label} className={`px-7 py-4 text-[18px] font-[700] ${pill.className}`}>{pill.label}</Pill>
          ))}
        </div>
      </div>

      <GlassCard className="mt-10 p-5 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
          <div className="text-[54px] sm:text-[62px]">{avatar}</div>
          <div>
            <div className="text-[32px] font-[800] tracking-[-0.05em] sm:text-[38px]">{displayName || 'Your name'}</div>
            <div className="mt-2 text-[15px] text-[var(--muted)] sm:text-[17px]">New challenger • 1200 rating</div>
          </div>
        </div>
        <div className="mt-8 text-[16px] font-[700] text-[var(--lime)] sm:mt-10 sm:text-[18px]">Your rating grows from verified matches.</div>
      </GlassCard>

      <div className="mt-12">
        <Button size="lg" fullWidth onClick={() => onDone({ displayName, avatar })} disabled={busy}>
          {busy ? 'Entering…' : 'Enter the arena'}
        </Button>
      </div>
    </AuthShell>
  );
}
