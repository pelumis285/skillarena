import React from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Landmark,
  PencilLine,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { betaApi } from '../lib/api';
import { PRIMARY_CURRENCY_LABEL, PRIMARY_LOCALE } from '../lib/market';
import { openPaystackCheckout } from '../lib/paystackPopup';
import type { PaymentRecord, PaymentRuntimeConfig, ResolvedBankAccount, SupportedBank, User, WalletTx } from '../lib/types';
import { money } from '../lib/utils';
import { Button, Field, Modal } from './ui';

type WalletViewProps = {
  user: User;
  balance: number;
  setBalance: (balance: number) => void;
  toast: (message: string) => void;
  refreshKey?: number;
  onRemoteMutation?: () => void;
  onUserChange?: (user: User) => void;
};

type DepositRequestInput = {
  amount: number;
  description: string;
};

type WithdrawalRequestInput = {
  amount: number;
  description: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

type PaymentActionResult = {
  balance: number;
  transactions: WalletTx[];
  payment: PaymentRecord;
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

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function maskAccountNumber(value?: string | null) {
  const digits = `${value ?? ''}`.replace(/\D/g, '');
  if (!digits) return 'Not saved yet';
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

function getHeldFunds(txs: WalletTx[]) {
  return txs
    .filter((tx) => tx.type === 'wager' && tx.status === 'pending')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

function formatWalletTimestamp(value: string) {
  const date = new Date(value);
  return `${date.toLocaleTimeString(PRIMARY_LOCALE, { hour: 'numeric', minute: '2-digit' })} • ${date.toLocaleDateString(PRIMARY_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function walletStatusClass(status: WalletTx['status']) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

export function WalletView({
  user,
  balance,
  setBalance,
  toast,
  refreshKey = 0,
  onRemoteMutation,
  onUserChange,
}: WalletViewProps) {
  const [txs, setTxs] = React.useState<WalletTx[]>([]);
  const [loading, setLoading] = React.useState(betaApi.isConfigured);
  const [busy, setBusy] = React.useState(false);
  const [saveMethodBusy, setSaveMethodBusy] = React.useState(false);
  const [openDep, setOpenDep] = React.useState(false);
  const [openWdr, setOpenWdr] = React.useState(false);
  const [paymentsConfig, setPaymentsConfig] = React.useState<PaymentRuntimeConfig | null>(null);
  const [banks, setBanks] = React.useState<SupportedBank[]>([]);
  const [banksLoading, setBanksLoading] = React.useState(false);

  const paystackDepositEnabled = paymentsConfig?.provider === 'paystack' && paymentsConfig.depositsEnabled && paymentsConfig.inlineCheckoutEnabled;
  const paystackWithdrawalEnabled = paymentsConfig?.provider === 'paystack' && paymentsConfig.withdrawalsEnabled;

  React.useEffect(() => {
    if (!betaApi.isConfigured) {
      setLoading(false);
      setPaymentsConfig(null);
      return;
    }

    let cancelled = false;

    const loadWallet = async () => {
      setLoading(true);
      try {
        const [transactions, config] = await Promise.all([
          betaApi.getTransactions(user.id).catch(() => []),
          betaApi.getPaymentsConfig().catch(() => null),
        ]);

        if (cancelled) return;
        setTxs(transactions);
        setPaymentsConfig(config);

        if (config?.provider === 'paystack') {
          const syncPayload = await betaApi.syncPayments(user.id).catch(() => null);
          if (!cancelled && syncPayload) {
            setBalance(syncPayload.balance);
            setTxs(syncPayload.transactions);
            onRemoteMutation?.();
          }

          if (config.withdrawalsEnabled) {
            setBanksLoading(true);
            const nextBanks = await betaApi.listBanks().catch(() => []);
            if (!cancelled) setBanks(nextBanks);
            if (!cancelled) setBanksLoading(false);
          } else {
            setBanks([]);
          }
        } else {
          setBanks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBanksLoading(false);
        }
      }
    };

    void loadWallet();

    return () => {
      cancelled = true;
    };
  }, [onRemoteMutation, refreshKey, setBalance, user.id]);

  const depositTotal = txs
    .filter((tx) => tx.type === 'deposit' || tx.type === 'referral_bonus' || tx.type === 'win')
    .reduce((sum, tx) => sum + Math.max(tx.amount, 0), 0);
  const heldFunds = getHeldFunds(txs);
  const withdrawableNow = Math.max(balance - heldFunds, 0);
  const recentTxs = txs.slice(0, 8);
  const railStatus = paystackDepositEnabled || paystackWithdrawalEnabled ? 'Live Paystack rail' : 'Demo payment rail';

  const syncWalletResult = React.useCallback((payload: PaymentActionResult | { balance: number; transactions: WalletTx[] }) => {
    setBalance(payload.balance);
    setTxs(payload.transactions);
    onRemoteMutation?.();
  }, [onRemoteMutation, setBalance]);

  const pollForPaymentResult = React.useCallback(async (reference: string) => {
    let lastKnown: PaymentActionResult | null = null;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      await wait(attempt === 0 ? 1800 : 3000);
      try {
        const result = await betaApi.verifyPayment({ userId: user.id, reference });
        lastKnown = result;
        syncWalletResult(result);
        if (result.payment.status === 'completed' || result.payment.status === 'failed' || result.payment.status === 'abandoned') {
          return result;
        }
      } catch (error) {
        if (attempt === 17) throw error;
      }
    }

    if (lastKnown) return lastKnown;

    const syncPayload = await betaApi.syncPayments(user.id);
    syncWalletResult(syncPayload);
    const payment = syncPayload.payments.find((entry) => entry.reference === reference);
    if (!payment) {
      throw new Error('We could not confirm this payment yet. Please check again in a moment.');
    }
    return {
      balance: syncPayload.balance,
      transactions: syncPayload.transactions,
      payment,
    } satisfies PaymentActionResult;
  }, [syncWalletResult, user.id]);

  const handleDeposit = async (input: DepositRequestInput) => {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Enter a valid deposit amount.');
      return;
    }

    setBusy(true);
    try {
      if (paystackDepositEnabled) {
        const initialized = await betaApi.initializeDeposit({ userId: user.id, amount });
        await openPaystackCheckout(initialized.accessCode);
        toast('Complete the Paystack checkout. We are already checking for confirmation.');
        const result = await pollForPaymentResult(initialized.payment.reference);
        setOpenDep(false);

        if (result.payment.status === 'completed') {
          toast(`Deposited ${money(amount)} successfully.`);
        } else if (result.payment.status === 'abandoned') {
          toast('Deposit was abandoned before Paystack confirmed it.');
        } else if (result.payment.status === 'failed') {
          toast(result.payment.failureReason || 'Deposit did not complete.');
        } else {
          toast('Deposit is still processing. Your wallet will update as soon as Paystack confirms it.');
        }
        return;
      }

      if (betaApi.isConfigured) {
        const payload = await betaApi.deposit({ userId: user.id, amount, description: input.description });
        syncWalletResult(payload);
      } else {
        setBalance(Number((balance + amount).toFixed(2)));
        setTxs((current) => [buildLocalTransaction('deposit', amount, input.description, 'completed'), ...current]);
      }
      setOpenDep(false);
      toast(`Deposited ${money(amount)} successfully.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWithdrawalMethod = async (input: {
    bankCode?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => {
    const normalizedAccountNumber = input.accountNumber.replace(/\D/g, '').slice(0, 10);
    if (normalizedAccountNumber.length !== 10) {
      throw new Error('Enter a valid 10-digit account number.');
    }
    if (!input.bankName.trim()) {
      throw new Error('Enter or select a bank.');
    }
    if (!input.accountName.trim()) {
      throw new Error('Account holder name is required.');
    }

    setSaveMethodBusy(true);
    try {
      if (betaApi.isConfigured) {
        const payload = await betaApi.updatePayoutDetails(user.id, {
          bankCode: input.bankCode ?? '',
          bankName: input.bankName.trim(),
          accountNumber: normalizedAccountNumber,
          accountName: input.accountName.trim(),
        });
        onUserChange?.(payload.user);
      } else {
        onUserChange?.({
          ...user,
          payoutBankCode: input.bankCode ?? null,
          payoutBankName: input.bankName.trim(),
          payoutAccountNumber: normalizedAccountNumber,
          payoutAccountName: input.accountName.trim(),
        });
      }
      toast('Withdrawal details saved.');
    } finally {
      setSaveMethodBusy(false);
    }
  };

  const handleWithdraw = async (input: WithdrawalRequestInput) => {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Enter a valid withdrawal amount.');
      return;
    }
    if (amount > balance) {
      toast('Insufficient balance for that withdrawal.');
      return;
    }

    setBusy(true);
    try {
      if (paystackWithdrawalEnabled) {
        if (!input.bankCode || !input.bankName || !input.accountNumber || !input.accountName) {
          toast('Verify a Nigerian bank account before requesting this withdrawal.');
          return;
        }

        const payload = await betaApi.requestWithdrawal({
          userId: user.id,
          amount,
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountNumber: input.accountNumber,
          accountName: input.accountName,
        });
        syncWalletResult(payload);
        setOpenWdr(false);

        if (payload.payment.status === 'completed') {
          toast('Withdrawal completed and sent to the selected bank account.');
        } else if (payload.payment.status === 'failed') {
          toast(payload.payment.failureReason || 'Withdrawal failed.');
        } else {
          toast('Withdrawal submitted. We will keep tracking it until Paystack completes it.');
        }
        return;
      }

      if (betaApi.isConfigured) {
        const payload = await betaApi.withdraw({ userId: user.id, amount, description: input.description });
        syncWalletResult(payload);
      } else {
        setBalance(Number((balance - amount).toFixed(2)));
        setTxs((current) => [buildLocalTransaction('withdrawal', -amount, input.description, 'pending'), ...current]);
      }
      setOpenWdr(false);
      toast('Withdrawal requested. Settlement usually lands in your bank within the next business day.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  };

  const resolveBankAccount = React.useCallback(async (input: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }) => {
    return betaApi.resolveBankAccount(input);
  }, []);

  return (
    <div className="mx-auto max-w-[32rem] pb-6 text-slate-900">
      <div className="overflow-hidden rounded-[2.4rem] border border-white/6 bg-[linear-gradient(180deg,#f7f4ee_0%,#ece8df_100%)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-5">
        <div className="inline-flex rounded-full bg-white px-4 py-3 text-[11px] font-[800] uppercase tracking-[0.16em] text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
          Wallet
        </div>

        <div className="mt-6 overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,#7f35ff_0%,#ae44ff_56%,#ca57ff_100%)] px-5 py-5 text-white shadow-[0_28px_55px_rgba(117,48,222,0.34)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-[800] uppercase tracking-[0.18em] text-white/78">Available balance</div>
              <div className="mt-4 text-[2.8rem] font-[850] leading-none tracking-[-0.08em]">{money(balance)}</div>
            </div>
            <div className="rounded-[1.15rem] bg-white/14 px-3 py-2 text-right backdrop-blur-xl">
              <div className="text-[10px] font-[800] uppercase tracking-[0.18em] text-white/72">Player</div>
              <div className="mt-1 text-[14px] font-[800]">{user.displayName}</div>
            </div>
          </div>
          <div className="mt-5 text-[13px] leading-6 text-white/82">
            Keep your wallet ready for stake matches, tournament entries, and direct Nigerian bank withdrawals.
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[1.6rem] bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-indigo-50 text-indigo-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="mt-3 text-[12px] font-[700] text-slate-500">Funds in active matches</div>
            <div className="mt-1 text-[1.55rem] font-[850] tracking-[-0.05em] text-slate-950">{money(heldFunds)}</div>
          </div>
          <div className="rounded-[1.6rem] bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div className="mt-3 text-[12px] font-[700] text-slate-500">Ready to withdraw</div>
            <div className="mt-1 text-[1.55rem] font-[850] tracking-[-0.05em] text-slate-950">{money(withdrawableNow)}</div>
          </div>
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-2 gap-3">
            <Button fullWidth onClick={() => setOpenDep(true)} className="justify-center">
              <ArrowDownLeft className="h-4 w-4" />
              Deposit
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setOpenWdr(true)} className="justify-center">
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </Button>
          </div>

          <div className="mt-4 rounded-[1.3rem] bg-[#101114] px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-[11px] font-[800] uppercase tracking-[0.16em] text-white/74">
              <ShieldCheck className="h-3.5 w-3.5 text-lime-300" />
              {loading ? 'Syncing wallet' : railStatus}
            </div>
            <div className="mt-2 text-[13px] leading-5 text-white/76">
              {paymentsConfig?.message ?? 'Wallet settings are loading from the server.'}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[2rem] bg-white p-5 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[18px] font-[850] tracking-[-0.03em] text-slate-900">Transaction history</div>
              <div className="mt-1 text-[13px] leading-5 text-slate-500">Deposits, winnings, wagers, and withdrawals linked to your wallet.</div>
            </div>
            <div className="text-right">
              <div className="text-[12px] font-[700] uppercase tracking-[0.14em] text-slate-500">Total money in</div>
              <div className="mt-1 text-[16px] font-[850] text-emerald-700">{money(depositTotal)}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {recentTxs.length ? recentTxs.map((tx) => {
              const positive = tx.amount >= 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 rounded-[1.45rem] bg-[#f8f8fb] px-4 py-3">
                  <div className={positive ? 'grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600' : 'grid h-12 w-12 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600'}>
                    {positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-[800] tracking-[-0.02em] text-slate-900">{tx.description}</div>
                    <div className="mt-1 text-[12px] leading-5 text-slate-500">{formatWalletTimestamp(tx.at)}</div>
                    <div className="mt-1 text-[11px] font-[700] uppercase tracking-[0.12em] text-slate-400">{tx.type.replace(/_/g, ' ')}</div>
                  </div>
                  <div className="text-right">
                    <div className={positive ? 'text-[15px] font-[850] tracking-[-0.03em] text-emerald-600' : 'text-[15px] font-[850] tracking-[-0.03em] text-slate-900'}>
                      {money(tx.amount)}
                    </div>
                    <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-[800] uppercase tracking-[0.12em] ${walletStatusClass(tx.status)}`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[1.45rem] bg-[#f8f8fb] px-4 py-5 text-[13px] leading-6 text-slate-500">
                No transactions yet. Fund your wallet, enter a stake match, or invite friends to start building your activity history.
              </div>
            )}
          </div>
        </div>
      </div>

      <DepositModal
        busy={busy}
        open={openDep}
        paymentsConfig={paymentsConfig}
        onClose={() => setOpenDep(false)}
        onDeposit={handleDeposit}
      />
      <WithdrawModal
        balance={balance}
        user={user}
        banks={banks}
        banksLoading={banksLoading}
        busy={busy}
        saveMethodBusy={saveMethodBusy}
        open={openWdr}
        paymentsConfig={paymentsConfig}
        onClose={() => setOpenWdr(false)}
        onResolveAccount={resolveBankAccount}
        onSaveMethod={handleSaveWithdrawalMethod}
        onWithdraw={handleWithdraw}
      />
    </div>
  );
}

function DepositModal({
  busy,
  open,
  paymentsConfig,
  onClose,
  onDeposit,
}:{
  busy: boolean;
  open: boolean;
  paymentsConfig: PaymentRuntimeConfig | null;
  onClose: () => void;
  onDeposit: (input: DepositRequestInput) => void;
}) {
  const [amount, setAmount] = React.useState(5000);
  const [method, setMethod] = React.useState('Bank transfer • NIP instant');
  const [reference, setReference] = React.useState('NIP-2048');
  const amountChipClass = 'rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[13px] transition';
  const paystackEnabled = paymentsConfig?.provider === 'paystack' && paymentsConfig.depositsEnabled && paymentsConfig.inlineCheckoutEnabled;

  React.useEffect(() => {
    if (!open) return;
    setAmount(5000);
    setMethod('Bank transfer • NIP instant');
    setReference('NIP-2048');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Fund wallet">
      <div className="space-y-4 text-white">
        <div className="rounded-[1.5rem] border border-[rgba(122,84,239,0.18)] bg-[linear-gradient(145deg,rgba(122,84,239,0.18),rgba(16,22,34,0.94))] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{paystackEnabled ? 'Paystack' : 'Demo mode'}</div>
          <div className="mt-2 text-[14px] leading-6 text-slate-200">
            {paystackEnabled
              ? (paymentsConfig?.message ?? 'This deposit will continue in Paystack checkout and credit your wallet after confirmation.')
              : 'This mirrors Nigerian funding rails for testing, but no real debit happens until Paystack is configured.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[13px]">
          {[2000, 5000, 10000, 20000].map((value) => (
            <button
              key={value}
              onClick={() => setAmount(value)}
              className={amount === value
                ? `${amountChipClass} border-[rgba(184,250,51,0.24)] bg-[var(--lime)] text-[#0d1117]`
                : `${amountChipClass} text-slate-200 hover:bg-white/[0.04]`}
            >
              {money(value)}
            </button>
          ))}
        </div>
        <Field label={`Amount (${PRIMARY_CURRENCY_LABEL})`} type="number" value={amount} onChange={(event) => setAmount(parseFloat(event.target.value) || 0)} />

        {!paystackEnabled ? (
          <>
            <label className="block text-[12.8px]">
              <div className="mb-3 font-[700] text-[var(--muted)]">Funding route</div>
              <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-5 py-4 text-[15px] text-[var(--text)] outline-none transition focus:border-[rgba(184,250,51,0.4)] focus:ring-2 focus:ring-[rgba(184,250,51,0.16)]">
                <option>Bank transfer • NIP instant</option>
                <option>Debit card • Verve / Mastercard</option>
                <option>USSD • supported banks</option>
              </select>
            </label>
            <Field label="Transfer reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="NIP-2048" />
          </>
        ) : null}

        <Button
          className="w-full justify-center py-3"
          disabled={busy}
          onClick={() => onDeposit({
            amount,
            description: paystackEnabled ? 'Wallet deposit via Paystack' : `${method} • ${reference.trim() || 'Demo reference'}`,
          })}
        >
          {busy ? 'Processing…' : paystackEnabled ? `Continue with Paystack • ${money(amount)}` : `Deposit ${money(amount)}`}
        </Button>
      </div>
    </Modal>
  );
}

function WithdrawModal({
  balance,
  user,
  banks,
  banksLoading,
  busy,
  saveMethodBusy,
  open,
  paymentsConfig,
  onClose,
  onResolveAccount,
  onSaveMethod,
  onWithdraw,
}:{
  balance: number;
  user: User;
  banks: SupportedBank[];
  banksLoading: boolean;
  busy: boolean;
  saveMethodBusy: boolean;
  open: boolean;
  paymentsConfig: PaymentRuntimeConfig | null;
  onClose: () => void;
  onResolveAccount: (input: { bankCode: string; bankName: string; accountNumber: string }) => Promise<ResolvedBankAccount>;
  onSaveMethod: (input: { bankCode?: string; bankName: string; accountNumber: string; accountName: string }) => Promise<void>;
  onWithdraw: (input: WithdrawalRequestInput) => void;
}) {
  const paystackEnabled = paymentsConfig?.provider === 'paystack' && paymentsConfig.withdrawalsEnabled;
  const [amount, setAmount] = React.useState(Math.min(5000, balance));
  const [method, setMethod] = React.useState('Bank transfer • Nigerian bank account');
  const [bankCode, setBankCode] = React.useState(user.payoutBankCode ?? '');
  const [bankName, setBankName] = React.useState(user.payoutBankName ?? '');
  const [accountNumber, setAccountNumber] = React.useState(user.payoutAccountNumber ?? '');
  const [accountName, setAccountName] = React.useState(user.payoutAccountName ?? '');
  const [resolveError, setResolveError] = React.useState('');
  const [resolving, setResolving] = React.useState(false);
  const [editingMethod, setEditingMethod] = React.useState(!(user.payoutBankName && user.payoutAccountNumber && user.payoutAccountName));
  const [reviewing, setReviewing] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const hasSavedMethod = Boolean(user.payoutBankName && user.payoutAccountNumber && user.payoutAccountName);
    setAmount(Math.min(5000, balance));
    setMethod('Bank transfer • Nigerian bank account');
    setBankCode(user.payoutBankCode ?? '');
    setBankName(user.payoutBankName ?? '');
    setAccountNumber(user.payoutAccountNumber ?? '');
    setAccountName(user.payoutAccountName ?? '');
    setResolveError('');
    setResolving(false);
    setEditingMethod(!hasSavedMethod);
    setReviewing(false);
    setFeedback(null);
  }, [balance, open, user.payoutAccountName, user.payoutAccountNumber, user.payoutBankCode, user.payoutBankName]);

  const hasWithdrawalMethod = Boolean(bankName.trim() && accountNumber.trim() && accountName.trim());
  const withdrawDisabled = busy || amount <= 0 || amount > balance || !hasWithdrawalMethod;

  const verifyAccount = React.useCallback(async () => {
    if (!paystackEnabled) return;
    if (!bankCode || accountNumber.trim().length < 10) return;
    setResolving(true);
    setResolveError('');
    try {
      const selectedBank = banks.find((entry) => entry.code === bankCode);
      const resolved = await onResolveAccount({
        bankCode,
        bankName: selectedBank?.name ?? bankName,
        accountNumber: accountNumber.trim(),
      });
      setBankName(resolved.bankName);
      setAccountNumber(resolved.accountNumber);
      setAccountName(resolved.accountName);
    } catch (error) {
      setAccountName('');
      setResolveError(error instanceof Error ? error.message : 'Could not verify this bank account.');
    } finally {
      setResolving(false);
    }
  }, [accountNumber, bankCode, bankName, banks, onResolveAccount, paystackEnabled]);

  React.useEffect(() => {
    if (!open || !paystackEnabled || editingMethod === false) return;
    if (!bankCode || accountNumber.trim().length !== 10) {
      setAccountName('');
      return;
    }
    const timer = window.setTimeout(() => {
      void verifyAccount();
    }, 420);
    return () => window.clearTimeout(timer);
  }, [accountNumber, bankCode, editingMethod, open, paystackEnabled, verifyAccount]);

  const saveMethod = async () => {
    try {
      setFeedback(null);
      await onSaveMethod({
        bankCode: paystackEnabled ? bankCode : undefined,
        bankName,
        accountNumber,
        accountName,
      });
      setEditingMethod(false);
      setFeedback({ type: 'success', message: `Saved withdrawal method ${bankName} • ${maskAccountNumber(accountNumber)}.` });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Could not save withdrawal details.' });
    }
  };

  const openReview = () => {
    if (!hasWithdrawalMethod) {
      setFeedback({ type: 'error', message: 'Save a withdrawal method before reviewing the payout.' });
      return;
    }
    if (amount <= 0) {
      setFeedback({ type: 'error', message: 'Enter a valid withdrawal amount.' });
      return;
    }
    if (amount > balance) {
      setFeedback({ type: 'error', message: 'Withdrawal amount is higher than your available balance.' });
      return;
    }
    setFeedback(null);
    setReviewing(true);
  };

  return (
    <Modal open={open} onClose={onClose} title={reviewing ? 'Review withdrawal' : 'Withdraw to bank'}>
      <div className="space-y-4 text-white">
        {reviewing ? (
          <>
            <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Review payout</div>
              <div className="mt-2 text-[14px] leading-6 text-slate-200">
                Confirm the saved withdrawal method and amount before sending the request.
              </div>
            </div>

            <div className="space-y-3 rounded-[1.5rem] bg-[rgba(255,255,255,0.04)] p-4">
              <ReviewRow label="Amount" value={money(amount)} />
              <ReviewRow label="Payout method" value={method} />
              <ReviewRow label="Account holder" value={accountName} />
              <ReviewRow label="Bank" value={bankName} />
              <ReviewRow label="Account number" value={maskAccountNumber(accountNumber)} />
              <ReviewRow label="Available balance" value={money(balance)} />
              <ReviewRow label="Balance after payout" value={money(Math.max(balance - amount, 0))} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" fullWidth onClick={() => setReviewing(false)} disabled={busy}>
                Back
              </Button>
              <Button
                fullWidth
                disabled={withdrawDisabled}
                onClick={() => onWithdraw({
                  amount,
                  description: `Withdrawal to ${bankName} • ${maskAccountNumber(accountNumber)}`,
                  bankCode: paystackEnabled ? bankCode : undefined,
                  bankName,
                  accountNumber,
                  accountName,
                })}
              >
                {busy ? 'Submitting…' : 'Submit withdrawal'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{paystackEnabled ? 'Bank payout' : 'Payout'}</div>
              <div className="mt-2 text-[14px] leading-6 text-slate-200">
                {paystackEnabled
                  ? (paymentsConfig?.message ?? 'Withdrawals go to a verified Nigerian bank account through Paystack.')
                  : 'Save the account that should receive your payout, then review the withdrawal before submitting it.'}
              </div>
            </div>

            {feedback ? (
              <div className={feedback.type === 'success'
                ? 'rounded-[1.25rem] border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-[13px] text-emerald-200'
                : 'rounded-[1.25rem] border border-rose-400/30 bg-rose-500/12 px-4 py-3 text-[13px] text-rose-200'}>
                <div className="flex items-center gap-2 font-[700]">
                  {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {feedback.message}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.45rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-[800] text-white">Saved withdrawal method</div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-300">
                    Select a saved payout method or edit the details before requesting cash-out.
                  </div>
                </div>
                {hasWithdrawalMethod ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMethod(true);
                      setFeedback(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-[12px] font-[800] text-white transition hover:bg-white/16"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Edit
                  </button>
                ) : null}
              </div>

              {hasWithdrawalMethod ? (
                <div className="mt-4 rounded-[1.2rem] bg-white/6 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/16 text-emerald-200">
                        <Landmark className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-[14px] font-[800] text-white">{bankName}</div>
                        <div className="mt-1 text-[12px] text-slate-300">{accountName}</div>
                      </div>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-[800] uppercase tracking-[0.16em] text-white">
                      {maskAccountNumber(accountNumber)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.2rem] bg-white/6 px-4 py-4 text-[13px] leading-6 text-slate-300">
                  No withdrawal method saved yet. Add your Nigerian bank details below.
                </div>
              )}
            </div>

            {editingMethod ? (
              <div className="space-y-4 rounded-[1.45rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4">
                <div className="text-[14px] font-[800] text-white">Withdrawal details</div>

                <label className="block text-[12.8px]">
                  <div className="mb-3 font-[700] text-[var(--muted)]">Payout method</div>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className="w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-5 py-4 text-[15px] text-[var(--text)] outline-none transition focus:border-[rgba(184,250,51,0.4)] focus:ring-2 focus:ring-[rgba(184,250,51,0.16)]"
                  >
                    <option>Bank transfer • Nigerian bank account</option>
                  </select>
                </label>

                {paystackEnabled ? (
                  <>
                    <label className="block text-[12.8px]">
                      <div className="mb-3 font-[700] text-[var(--muted)]">Bank</div>
                      <select
                        value={bankCode}
                        onChange={(event) => {
                          const nextCode = event.target.value;
                          const selectedBank = banks.find((entry) => entry.code === nextCode);
                          setBankCode(nextCode);
                          setBankName(selectedBank?.name ?? '');
                          setAccountName('');
                          setResolveError('');
                          setFeedback(null);
                        }}
                        className="w-full rounded-[1.6rem] border border-[rgba(255,255,255,0.06)] bg-[var(--surface-2)] px-5 py-4 text-[15px] text-[var(--text)] outline-none transition focus:border-[rgba(184,250,51,0.4)] focus:ring-2 focus:ring-[rgba(184,250,51,0.16)]"
                      >
                        <option value="">{banksLoading ? 'Loading Nigerian banks...' : 'Select a bank'}</option>
                        {banks.map((bank) => (
                          <option key={bank.code} value={bank.code}>{bank.name}</option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="Account number"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(event) => {
                        setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10));
                        setAccountName('');
                        setResolveError('');
                        setFeedback(null);
                      }}
                    />
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" type="button" disabled={saveMethodBusy || resolving || !bankCode || accountNumber.length < 10} onClick={() => void verifyAccount()}>
                        {resolving ? 'Verifying…' : 'Verify account'}
                      </Button>
                      <div className="text-[12px] text-slate-400">{accountName ? `Verified as ${accountName}` : 'Verify the account holder name before saving.'}</div>
                    </div>
                    {resolveError ? <div className="text-[12px] text-rose-300">{resolveError}</div> : null}
                    <Field label="Account holder" value={accountName} readOnly placeholder="Verified name will appear here" />
                  </>
                ) : (
                  <>
                    <Field label="Bank or financial institution" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Access Bank" />
                    <Field
                      label="Account number"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                    <Field label="Account holder" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Samuel Oluwapelumi" />
                  </>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    fullWidth
                    disabled={saveMethodBusy}
                    onClick={() => {
                      if (user.payoutBankName && user.payoutAccountNumber && user.payoutAccountName) {
                        setBankCode(user.payoutBankCode ?? '');
                        setBankName(user.payoutBankName ?? '');
                        setAccountNumber(user.payoutAccountNumber ?? '');
                        setAccountName(user.payoutAccountName ?? '');
                        setEditingMethod(false);
                        setResolveError('');
                        setFeedback(null);
                        return;
                      }
                      onClose();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button fullWidth disabled={saveMethodBusy || resolving} onClick={() => { void saveMethod(); }}>
                    {saveMethodBusy ? 'Saving…' : 'Save withdrawal details'}
                  </Button>
                </div>
              </div>
            ) : null}

            <Field label={`Withdrawal amount (${PRIMARY_CURRENCY_LABEL})`} type="number" value={amount} onChange={(event) => setAmount(parseFloat(event.target.value) || 0)} />
            <div className="flex items-center justify-between rounded-[1.2rem] bg-white/6 px-4 py-3 text-[13px] text-slate-200">
              <span>Available balance</span>
              <span className="font-[800] text-white">{money(balance)}</span>
            </div>

            <Button className="w-full justify-center" disabled={withdrawDisabled || editingMethod} onClick={openReview}>
              Review withdrawal
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-white/6 px-3 py-3">
      <div className="text-[12px] font-[700] uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="text-right text-[13px] font-[760] text-white">{value}</div>
    </div>
  );
}
