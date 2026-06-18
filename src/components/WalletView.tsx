import React from 'react';
import { betaApi } from '../lib/api';
import type { User, WalletTx } from '../lib/types';
import { money } from '../lib/utils';
import { Badge, Button, Field, GlassCard, Modal } from './ui';
import { ArrowDownLeft, ArrowUpRight, Gift, ShieldCheck, Sparkles } from 'lucide-react';

type WalletViewProps = {
  user: User;
  balance: number;
  setBalance: (balance: number) => void;
  toast: (message: string) => void;
  refreshKey?: number;
  onRemoteMutation?: () => void;
};

function buildLocalTransaction(type: WalletTx['type'], amount: number, description: string, status: WalletTx['status']): WalletTx {
  return {
    id: `${type}_${Date.now()}`,
    type,
    amount,
    status,
    description,
    at: new Date().toISOString(),
  };
}

export function WalletView({
  user,
  balance,
  setBalance,
  toast,
  refreshKey = 0,
  onRemoteMutation,
}: WalletViewProps) {
  const [txs, setTxs] = React.useState<WalletTx[]>([]);
  const [loading, setLoading] = React.useState(betaApi.isConfigured);
  const [busy, setBusy] = React.useState(false);
  const [openDep, setOpenDep] = React.useState(false);
  const [openWdr, setOpenWdr] = React.useState(false);

  React.useEffect(() => {
    if (!betaApi.isConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    betaApi.getTransactions(user.id)
      .then((transactions) => {
        if (cancelled) return;
        setTxs(transactions);
      })
      .catch(() => {
        if (cancelled) return;
        setTxs([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, user.id]);

  const depositTotal = txs
    .filter((tx) => tx.type === 'deposit' || tx.type === 'referral_bonus' || tx.type === 'win')
    .reduce((sum, tx) => sum + Math.max(tx.amount, 0), 0);
  const withdrawalTotal = txs
    .filter((tx) => tx.type === 'withdrawal' || tx.type === 'wager')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const bonusCash = txs
    .filter((tx) => tx.type === 'referral_bonus')
    .reduce((sum, tx) => sum + Math.max(tx.amount, 0), 0);

  const handleDeposit = async (amount: number, description: string) => {
    if (amount <= 0) {
      toast('Enter a valid deposit amount.');
      return;
    }

    setBusy(true);
    try {
      if (betaApi.isConfigured) {
        const payload = await betaApi.deposit({ userId: user.id, amount, description });
        setBalance(payload.balance);
        setTxs(payload.transactions);
        onRemoteMutation?.();
      } else {
        setBalance(Number((balance + amount).toFixed(2)));
        setTxs((current) => [buildLocalTransaction('deposit', amount, description, 'completed'), ...current]);
      }
      setOpenDep(false);
      toast(`Deposited ${money(amount)} successfully.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async (amount: number, description: string) => {
    if (amount <= 0) {
      toast('Enter a valid withdrawal amount.');
      return;
    }
    if (amount > balance) {
      toast('Insufficient balance for that withdrawal.');
      return;
    }

    setBusy(true);
    try {
      if (betaApi.isConfigured) {
        const payload = await betaApi.withdraw({ userId: user.id, amount, description });
        setBalance(payload.balance);
        setTxs(payload.transactions);
        onRemoteMutation?.();
      } else {
        setBalance(Number((balance - amount).toFixed(2)));
        setTxs((current) => [buildLocalTransaction('withdrawal', -amount, description, 'pending'), ...current]);
      }
      setOpenWdr(false);
      toast('Withdrawal requested. Usually settles in 24h.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-6 text-white">
      <div className="px-1">
        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-500">Cash desk</div>
        <h2 className="mt-1 text-[30px] font-[850] tracking-[-0.04em]">Wallet</h2>
        <div className="mt-1 text-[13px] text-slate-400">Deposit, withdraw, and track every balance movement tied to your player account.</div>
      </div>

      <GlassCard className="relative overflow-hidden border-indigo-400/[0.16] bg-gradient-to-br from-indigo-500/30 via-violet-500/[0.16] to-[#101729] p-5">
        <div className="absolute right-[-3rem] top-[-2rem] h-40 w-40 rounded-full bg-indigo-300/[0.14] blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant="gold">Available balance</Badge>
              <div className="mt-3 text-[36px] font-[900] tracking-[-0.05em]">{money(balance)}</div>
              <div className="mt-2 text-[13px] text-slate-300">Your live account balance is the source for stakes, winnings, and withdrawals.</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Live ledger
              </div>
              <div className="mt-2 text-[18px] font-[800] text-emerald-300">{txs.length}</div>
              <div className="text-[12px] text-slate-300">Transactions</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="gold" fullWidth onClick={() => setOpenDep(true)} disabled={busy}>
              <ArrowDownLeft className="h-4 w-4" />
              Deposit
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setOpenWdr(true)} disabled={busy}>
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-3">
        <GlassCard className="p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Money in</div>
          <div className="mt-2 text-[20px] font-[850] tracking-[-0.04em] text-emerald-300">{money(depositTotal)}</div>
          <div className="mt-1 text-[12px] text-slate-400">Deposits and payouts</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Money out</div>
          <div className="mt-2 text-[20px] font-[850] tracking-[-0.04em] text-white">{money(withdrawalTotal)}</div>
          <div className="mt-1 text-[12px] text-slate-400">Wagers and withdrawals</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <Gift className="h-3.5 w-3.5 text-violet-300" />
            Referral cash
          </div>
          <div className="mt-2 text-[20px] font-[850] tracking-[-0.04em] text-violet-200">{money(bonusCash)}</div>
          <div className="mt-1 text-[12px] text-slate-400">Invite rewards earned</div>
        </GlassCard>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent transactions</div>
            <div className="text-[12px] text-slate-500">Deposits, wagers, winnings, withdrawals, and referral bonuses.</div>
          </div>
          {loading ? <Badge variant="default">Updating…</Badge> : <Badge variant="emerald">{txs.length} entries</Badge>}
        </div>

        {txs.length ? txs.map((tx) => {
          const positive = tx.amount >= 0;
          return (
            <GlassCard key={tx.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className={positive ? 'grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/[0.16] text-emerald-300' : 'grid h-11 w-11 place-items-center rounded-2xl bg-rose-400/[0.16] text-rose-300'}>
                  {positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-[760]">{tx.description}</div>
                  <div className="text-[12px] text-slate-400">
                    {new Date(tx.at).toLocaleString()} • {tx.type.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className={positive ? 'text-[14px] font-[820] text-emerald-300' : 'text-[14px] font-[820] text-white'}>{money(tx.amount)}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{tx.status}</div>
                </div>
              </div>
            </GlassCard>
          );
        }) : (
          <GlassCard className="p-4 text-[13px] text-slate-400">
            No transactions yet. Add funds or play a stake match and your wallet history will appear here.
          </GlassCard>
        )}
      </div>

      <DepositModal
        busy={busy}
        open={openDep}
        onClose={() => setOpenDep(false)}
        onDeposit={handleDeposit}
      />
      <WithdrawModal
        busy={busy}
        balance={balance}
        open={openWdr}
        onClose={() => setOpenWdr(false)}
        onWithdraw={handleWithdraw}
      />
    </div>
  );
}

function DepositModal({
  busy,
  open,
  onClose,
  onDeposit,
}:{
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onDeposit: (amount: number, description: string) => void;
}) {
  const [amount, setAmount] = React.useState(25);
  const [card, setCard] = React.useState('4242 4242 4242 4242');

  return (
    <Modal open={open} onClose={onClose} title="Deposit funds">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-[13px]">
          {[10, 25, 50, 100].map((value) => (
            <button
              key={value}
              onClick={() => setAmount(value)}
              className={'rounded-full border px-3 py-1.5 ' + (amount === value ? 'border-zinc-900 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700')}
            >
              ${value}
            </button>
          ))}
        </div>
        <Field label="Amount (USD)" type="number" value={amount} onChange={(event) => setAmount(parseFloat(event.target.value) || 0)} />
        <Field label="Card number" value={card} onChange={(event) => setCard(event.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expiry" placeholder="12/28" />
          <Field label="CVC" placeholder="123" />
        </div>
        <div className="rounded-[16px] bg-[#f7f3ea] px-3 py-2 text-[12.6px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Demo mode only. No real charge happens here yet, but the ledger and admin dashboard will track the test deposit.
        </div>
        <Button className="w-full justify-center py-3" disabled={busy} onClick={() => onDeposit(amount, `Card deposit • ${card.slice(-4)}`)}>
          {busy ? 'Processing…' : `Deposit ${money(amount)}`}
        </Button>
      </div>
    </Modal>
  );
}

function WithdrawModal({
  busy,
  open,
  onClose,
  balance,
  onWithdraw,
}:{
  busy: boolean;
  open: boolean;
  onClose: () => void;
  balance: number;
  onWithdraw: (amount: number, description: string) => void;
}) {
  const [amount, setAmount] = React.useState(Math.min(20, balance));

  React.useEffect(() => {
    setAmount(Math.min(20, balance));
  }, [balance, open]);

  return (
    <Modal open={open} onClose={onClose} title="Withdraw funds">
      <div className="space-y-4">
        <Field label="Amount" type="number" value={amount} onChange={(event) => setAmount(parseFloat(event.target.value) || 0)} />
        <div className="text-[13px] text-zinc-600 dark:text-zinc-400">Available: {money(balance)}</div>
        <label className="block text-[12.8px]">
          <div className="mb-1.5 text-zinc-600 font-[550] dark:text-zinc-400">Payout method</div>
          <select className="w-full rounded-[16px] border border-zinc-200 bg-[#f5f2ee] px-3.5 py-3 outline-none dark:border-zinc-700 dark:bg-zinc-800">
            <option>Bank transfer • ACH (1–2 days)</option>
            <option>Instant Card • 1.5% fee</option>
          </select>
        </label>
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-slate-400">
          Withdrawals are stored as pending so the admin ledger can review them before settlement.
        </div>
        <Button className="w-full justify-center" disabled={busy || amount <= 0 || amount > balance} onClick={() => onWithdraw(amount, 'Payout to player wallet')}>
          {busy ? 'Submitting…' : 'Request withdrawal'}
        </Button>
      </div>
    </Modal>
  );
}
