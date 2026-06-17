import React from 'react';
import { money } from '../lib/utils';
import { Badge, Button, GlassCard, Modal, Field } from './ui';
import { mockTransactions } from '../lib/mock';
import type { WalletTx } from '../lib/types';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';

export function WalletView({ balance, setBalance, toast }:{ balance:number, setBalance:(n:number|((b:number)=>number))=>void, toast:(m:string)=>void }) {
  const [txs,setTxs] = React.useState<WalletTx[]>(mockTransactions);
  const [openDep,setOpenDep]=React.useState(false);
  const [openWdr,setOpenWdr]=React.useState(false);

  const addTx = (t: WalletTx) => setTxs(x=>[t, ...x]);
  const withdrawable = Math.max(0, balance - 12.5);
  const bonusCash = Math.max(0, balance - withdrawable);

  return (
    <div className="space-y-6 pb-6 text-white">
      <div className="px-1">
        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-500">Cash desk</div>
        <h2 className="mt-1 text-[30px] font-[850] tracking-[-0.04em]">Wallet</h2>
        <div className="mt-1 text-[13px] text-slate-400">Deposit, withdraw, and track how your game balance is moving.</div>
      </div>

      <GlassCard className="relative overflow-hidden border-indigo-400/[0.16] bg-gradient-to-br from-indigo-500/30 via-violet-500/[0.16] to-[#101729] p-5">
        <div className="absolute right-[-3rem] top-[-2rem] h-40 w-40 rounded-full bg-indigo-300/[0.14] blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant="gold">Available balance</Badge>
              <div className="mt-3 text-[36px] font-[900] tracking-[-0.05em]">{money(balance)}</div>
              <div className="mt-2 text-[13px] text-slate-300">Withdrawals unlock after 3 verified matches and anti-fraud checks.</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Protected
              </div>
              <div className="mt-2 text-[18px] font-[800] text-emerald-300">+$62.40</div>
              <div className="text-[12px] text-slate-300">This month</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="gold" fullWidth onClick={()=>setOpenDep(true)}>
              <ArrowDownLeft className="h-4 w-4" />
              Deposit
            </Button>
            <Button variant="secondary" fullWidth onClick={()=>setOpenWdr(true)}>
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Withdrawable</div>
          <div className="mt-2 text-[22px] font-[850] tracking-[-0.04em] text-white">{money(withdrawable)}</div>
          <div className="mt-1 text-[12px] text-slate-400">Ready for ACH or instant card payout.</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            Bonus cash
          </div>
          <div className="mt-2 text-[22px] font-[850] tracking-[-0.04em] text-violet-200">{money(bonusCash)}</div>
          <div className="mt-1 text-[12px] text-slate-400">Promo credits and mission rewards waiting to cycle into play.</div>
        </GlassCard>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[18px] font-[800] tracking-[-0.03em]">Recent transactions</div>
            <div className="text-[12px] text-slate-500">Every stake, payout and top-up in one place.</div>
          </div>
          <Badge variant="emerald">{txs.length} entries</Badge>
        </div>

        {txs.map((t) => {
          const positive = t.amount >= 0;
          return (
            <GlassCard key={t.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className={positive ? 'grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/[0.16] text-emerald-300' : 'grid h-11 w-11 place-items-center rounded-2xl bg-rose-400/[0.16] text-rose-300'}>
                  {positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-[760]">{t.description}</div>
                  <div className="text-[12px] text-slate-400">{new Date(t.at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className={positive ? 'text-[14px] font-[820] text-emerald-300' : 'text-[14px] font-[820] text-white'}>{money(t.amount)}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t.status}</div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <DepositModal open={openDep} onClose={()=>setOpenDep(false)} onDeposit={(amt)=>{
        setBalance(b=>b+amt);
        addTx({ id:'d'+Date.now(), type:'deposit', amount:amt, status:'completed', description:'Stripe deposit • •••• 4242', at:new Date().toISOString()});
        setOpenDep(false);
        toast(`Deposited ${money(amt)} successfully.`);
      }}/>
      <WithdrawModal balance={balance} open={openWdr} onClose={()=>setOpenWdr(false)} onWithdraw={(amt)=>{
        setBalance(b=>b-amt);
        addTx({ id:'w'+Date.now(), type:'withdrawal', amount:-amt, status:'pending', description:'Payout to bank • 1-2 business days', at:new Date().toISOString()});
        setOpenWdr(false);
        toast('Withdrawal requested. Usually settles in 24h.');
      }}/>
    </div>
  );
}

function DepositModal({ open, onClose, onDeposit }:{ open:boolean,onClose:()=>void,onDeposit:(amt:number)=>void }) {
  const [amt,setAmt] = React.useState(25);
  const [card,setCard] = React.useState('4242 4242 4242 4242');
  return (
    <Modal open={open} onClose={onClose} title="Deposit funds">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap text-[13px]">
          {[10,25,50,100].map(v=> <button key={v} onClick={()=>setAmt(v)} className={"px-3 py-1.5 rounded-full border "+(amt===v ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900":"border-zinc-300 dark:border-zinc-700")}>${v}</button>)}
        </div>
        <Field label="Amount (USD)" type="number" value={amt} onChange={e=>setAmt(parseFloat(e.target.value)||0)} />
        <Field label="Card number" value={card} onChange={e=>setCard(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expiry" placeholder="12/28"/>
          <Field label="CVC" placeholder="123"/>
        </div>
        <div className="rounded-[16px] bg-[#f7f3ea] px-3 py-2 text-[12.6px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Stripe test mode. No real charges. Use 4242 4242 4242 4242.</div>
        <Button className="w-full justify-center py-3" onClick={()=>onDeposit(amt)}>Deposit {money(amt)}</Button>
      </div>
    </Modal>
  );
}

function WithdrawModal({ open, onClose, balance, onWithdraw }:{ open:boolean,onClose:()=>void,balance:number, onWithdraw:(amt:number)=>void}) {
  const [amt,setAmt] = React.useState(Math.min(20, balance));
  return (
    <Modal open={open} onClose={onClose} title="Withdraw funds">
      <div className="space-y-4">
        <Field label="Amount" type="number" value={amt} onChange={e=>setAmt(parseFloat(e.target.value)||0)} />
        <div className="text-[13px] text-zinc-600 dark:text-zinc-400">Available: {money(balance)}</div>
        <label className="block text-[12.8px]">
          <div className="text-zinc-600 mb-1.5 font-[550] dark:text-zinc-400">Payout method</div>
          <select className="w-full rounded-[16px] bg-[#f5f2ee] border border-zinc-200 px-3.5 py-3 outline-none dark:bg-zinc-800 dark:border-zinc-700">
            <option>Bank transfer • ACH (1–2 days)</option>
            <option>Instant Card • 1.5% fee</option>
          </select>
        </label>
        <Button className="w-full justify-center" disabled={amt<=0 || amt>balance} onClick={()=>onWithdraw(amt)}>Request withdrawal</Button>
      </div>
    </Modal>
  );
}
