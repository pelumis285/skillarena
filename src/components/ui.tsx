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
  const base = 'inline-flex items-center justify-center gap-2 font-[600] transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none';
  const styles = {
    primary: 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] hover:brightness-110',
    secondary: 'border border-white/10 bg-white/10 text-white backdrop-blur-xl hover:bg-white/[0.16]',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.08]',
    soft: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
    outline: 'border border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-white/[0.12] dark:text-white dark:hover:bg-white/[0.08]',
    danger: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-[0_10px_24px_rgba(244,63,94,0.28)] hover:brightness-110',
    subtle: 'bg-[#f3f0eb] text-zinc-800 hover:bg-[#e8e3db] dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
    gold: 'bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 text-[#27160a] shadow-[0_10px_24px_rgba(250,204,21,0.3)] hover:brightness-105',
  };
  const sizes = {
    sm: 'rounded-xl px-3.5 py-2 text-[12.5px]',
    md: 'rounded-full px-4 py-2.5 text-[13.5px]',
    lg: 'rounded-2xl px-5 py-3.5 text-[15px]',
  };
  return <button className={cn(base, styles[variant], sizes[size], fullWidth && 'w-full', className)} {...props} />;
};

export const Card = ({ className='', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-[26px] bg-white border border-zinc-200 shadow-[0_8px_34px_rgba(0,0,0,0.05)] dark:bg-zinc-900/90 dark:border-zinc-800', className)} {...props}>{children}</div>
);

export const GlassCard = ({
  className = '',
  interactive = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) => (
  <div
    className={cn(
      'rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)]',
      interactive && 'transition hover:-translate-y-0.5 hover:bg-white/10 hover:border-white/[0.16]',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const Pill = ({ children, className='' }: { children: React.ReactNode, className?: string }) => (
  <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-[650] bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300', className)}>{children}</span>
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
    default: 'border border-white/10 bg-white/10 text-slate-200',
    gold: 'border border-amber-300/30 bg-amber-300/[0.18] text-amber-200',
    emerald: 'border border-emerald-400/[0.26] bg-emerald-400/[0.16] text-emerald-200',
    purple: 'border border-violet-400/[0.26] bg-violet-400/[0.16] text-violet-200',
    rose: 'border border-rose-400/[0.26] bg-rose-400/[0.16] text-rose-200',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-[650] backdrop-blur-md', styles[variant], className)}>
      {children}
    </span>
  );
};

export const Field = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="block text-[12.8px]">
    <div className="text-zinc-600 mb-1.5 font-[550] dark:text-zinc-400">{label}</div>
    <input {...props} className={cn("w-full rounded-[16px] bg-[#f5f2ee] border border-zinc-200 px-3.5 py-3 outline-none focus:ring-[3px] focus:ring-amber-200/80 focus:border-amber-400 text-[14.5px] dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100", props.className)} />
  </label>
);

export function Modal({ open, onClose, title, children, maxWidth='max-w-lg' }: { open: boolean, onClose: ()=>void, title: string, children: React.ReactNode, maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="absolute inset-0 bg-zinc-950/45 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative flex min-h-full items-start justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] pb-[max(88px,calc(env(safe-area-inset-bottom)+88px))] sm:items-center sm:p-4">
        <div className={cn("relative w-full max-h-[calc(100dvh-24px)] overflow-hidden rounded-[28px] bg-white shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800", maxWidth)}>
          <div className="flex max-h-[calc(100dvh-24px)] flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-7 dark:border-zinc-800">
              <div className="text-[18.5px] font-[730] tracking-[-0.01em]" style={{fontFamily:'Fraunces, serif'}}>{title}</div>
              <button onClick={onClose} className="px-2.5 py-1.5 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastViewport({ toasts }: { toasts: {id:number, msg:string}[] }) {
  return (
    <div className="fixed z-[80] bottom-5 right-5 flex flex-col gap-2">
      {toasts.map(t=>(
        <div key={t.id} className="px-4 py-2.5 rounded-2xl bg-zinc-900 text-zinc-50 text-[13px] shadow-lg dark:bg-zinc-100 dark:text-zinc-900">{t.msg}</div>
      ))}
    </div>
  );
}
