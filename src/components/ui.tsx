import React from 'react';
import { cn } from '../lib/utils';

export const Button = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary'|'secondary'|'ghost'|'soft'|'outline'|'danger'|'subtle'|'gold';
  size?: 'sm'|'md'|'lg';
  fullWidth?: boolean;
}) => {
  const base = 'inline-flex items-center justify-center gap-2 font-[800] tracking-[-0.02em] transition active:scale-[.985] disabled:opacity-50 disabled:pointer-events-none';
  const styles = {
    primary: 'border border-[rgba(184,250,51,0.24)] bg-[var(--lime)] text-[#0d1117] shadow-[0_18px_40px_rgba(184,250,51,0.18)] hover:brightness-[1.04]',
    secondary: 'border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-3)]',
    ghost: 'bg-transparent text-[var(--muted)] hover:text-white',
    soft: 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[var(--text)] hover:bg-[rgba(255,255,255,0.08)]',
    outline: 'border border-[rgba(255,255,255,0.12)] bg-transparent text-[var(--text)] hover:bg-white/[0.04]',
    danger: 'border border-transparent bg-[#4b1821] text-[#ff667b] hover:bg-[#5a1b27]',
    subtle: 'border border-[rgba(255,255,255,0.06)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
    gold: 'border border-transparent bg-gradient-to-r from-[var(--orange)] to-[#ffb547] text-[#15110c] hover:brightness-[1.04]',
  };
  const sizes = {
    sm: 'rounded-[1.15rem] px-4 py-2.5 text-[13px]',
    md: 'rounded-[1.45rem] px-5 py-3.5 text-[15px]',
    lg: 'rounded-[1.65rem] px-6 py-4 text-[18px]',
  };

  return <button className={cn(base, styles[variant], sizes[size], fullWidth && 'w-full', className)} {...props} />;
};

export const Card = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface)] text-[var(--text)] shadow-[0_20px_50px_rgba(0,0,0,0.2)]', className)} {...props}>
    {children}
  </div>
);

export const GlassCard = ({
  className = '',
  interactive = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) => (
  <div
    className={cn(
      'skill-card relative overflow-hidden text-[var(--text)]',
      interactive && 'transition hover:-translate-y-0.5 hover:bg-[var(--surface-2)]',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const Pill = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[12px] font-[700] text-[var(--text)]', className)}>
    {children}
  </span>
);

export const Badge = ({
  children,
  className = '',
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gold' | 'emerald' | 'purple' | 'rose';
}) => {
  const styles = {
    default: 'bg-[var(--surface-2)] text-[var(--muted)] border border-[rgba(255,255,255,0.06)]',
    gold: 'bg-[rgba(255,181,71,0.18)] text-[#ffd68b] border border-[rgba(255,181,71,0.18)]',
    emerald: 'bg-[rgba(52,198,131,0.2)] text-[#4fe59d] border border-[rgba(52,198,131,0.18)]',
    purple: 'bg-[rgba(122,84,239,0.22)] text-[#c7b2ff] border border-[rgba(122,84,239,0.2)]',
    rose: 'bg-[rgba(190,61,82,0.22)] text-[#ff9eb0] border border-[rgba(190,61,82,0.2)]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-[800] tracking-[0.02em]', styles[variant], className)}>
      {children}
    </span>
  );
};

export const Field = ({ label, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="block text-[13px]">
    <div className="mb-3 font-[700] text-[var(--muted)]">{label}</div>
    <input
      {...props}
      className={cn(
        'w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-5 py-4 text-[16px] text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(184,250,51,0.4)] focus:ring-2 focus:ring-[rgba(184,250,51,0.16)]',
        className,
      )}
    />
  </label>
);

export function Modal({ open, onClose, title, children, maxWidth='max-w-lg' }: { open: boolean, onClose: ()=>void, title: string, children: React.ReactNode, maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="absolute inset-0 bg-[#050912]/82 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex min-h-full items-start justify-center px-4 pt-[max(18px,env(safe-area-inset-top))] pb-[max(88px,calc(env(safe-area-inset-bottom)+88px))]">
        <div className={cn('w-full overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[var(--bg-soft)] text-[var(--text)] shadow-[0_30px_70px_rgba(0,0,0,0.45)]', maxWidth)}>
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-5 py-4">
            <div className="text-[20px] font-[800] tracking-[-0.03em]">{title}</div>
            <button onClick={onClose} className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[var(--muted)] transition hover:text-white">✕</button>
          </div>
          <div className="max-h-[calc(100dvh-100px)] overflow-y-auto px-5 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastViewport({ toasts }: { toasts: {id:number, msg:string}[] }) {
  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[min(92vw,24rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="rounded-[1.4rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--text)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
          {toast.msg}
        </div>
      ))}
    </div>
  );
}
