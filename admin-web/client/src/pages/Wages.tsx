/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL payout workspace with daily, weekly, monthly captain statements; #0060B8 hierarchy and Cairo typography.
 */
import { type FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Banknote, CircleCheckBig, CircleDollarSign, ClipboardList, Home as HomeIcon, Menu, Package, Send, Truck, UsersRound, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WagePeriodControls } from "@/components/WagePeriodControls";
import { captainProfiles, dayOptions, filterWageOrders, formatMoney, getPeriodOptions, wageOrders, type Period } from "@/lib/wage-data";

type Payout = { id: string; captainId: string; amount: number; date: string; dayKey: string; weekKey: string; monthKey: string; note: string };

const navItems = [
  { id: "more", label: "المزيد", icon: Menu },
  { id: "orders", label: "الطلبات", icon: Package },
  { id: "home", label: "الرئيسية", icon: HomeIcon },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "fees", label: "الأجور", icon: WalletCards },
];

function currentKeys(period: Period, periodKey: string) {
  const sample = wageOrders.find((order) => (period === "daily" ? order.dayKey : period === "weekly" ? order.weekKey : order.monthKey) === periodKey) ?? wageOrders[0];
  return { dayKey: period === "daily" ? periodKey : sample.dayKey, weekKey: period === "weekly" ? periodKey : sample.weekKey, monthKey: period === "monthly" ? periodKey : sample.monthKey };
}

export default function Wages() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("daily");
  const [periodKey, setPeriodKey] = useState(dayOptions[0].key);
  const [selectedCaptainId, setSelectedCaptainId] = useState(captainProfiles[0].id);
  const [payouts, setPayouts] = useState<Payout[]>([
    { id: "payout-1", captainId: "captain-1", amount: 18000, date: "19 آب، 01:10 م", dayKey: "2026-08-19", weekKey: "2026-W34", monthKey: "2026-08", note: "دفعة يومية" },
    { id: "payout-2", captainId: "captain-3", amount: 15000, date: "18 آب، 06:30 م", dayKey: "2026-08-18", weekKey: "2026-W34", monthKey: "2026-08", note: "دفعة يومية" },
  ]);
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const changePeriod = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    setPeriodKey(getPeriodOptions(nextPeriod)[0].key);
  };
  const periodOrders = useMemo(() => filterWageOrders(wageOrders, period, periodKey), [period, periodKey]);
  const periodPayouts = useMemo(() => payouts.filter((payout) => period === "daily" ? payout.dayKey === periodKey : period === "weekly" ? payout.weekKey === periodKey : payout.monthKey === periodKey), [payouts, period, periodKey]);
  const summaries = useMemo(() => captainProfiles.map((captain) => {
    const orders = periodOrders.filter((order) => order.captainId === captain.id);
    const gross = orders.reduce((sum, order) => sum + order.gross, 0);
    const due = gross * 0.7;
    const paid = periodPayouts.filter((payout) => payout.captainId === captain.id).reduce((sum, payout) => sum + payout.amount, 0);
    return { ...captain, orders, gross, due, paid, pending: Math.max(due - paid, 0) };
  }), [periodOrders, periodPayouts]);
  const selectedCaptain = summaries.find((captain) => captain.id === selectedCaptainId) ?? summaries[0];
  const totalDue = summaries.reduce((sum, captain) => sum + captain.due, 0);
  const totalPaid = summaries.reduce((sum, captain) => sum + captain.paid, 0);
  const selectedPayouts = periodPayouts.filter((payout) => payout.captainId === selectedCaptain.id);
  const periodLabel = getPeriodOptions(period).find((option) => option.key === periodKey)?.label ?? "";

  const openPayout = () => { setPaymentAmount(String(Math.round(selectedCaptain.pending))); setPaymentNote(""); setIsPayoutOpen(true); };
  const submitPayout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(paymentAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("أدخل مبلغ دفعة صحيحاً.");
    if (amount > selectedCaptain.pending) return toast.error("المبلغ أكبر من المستحق المتبقي للكابتن لهذه الفترة.");
    const keys = currentKeys(period, periodKey);
    setPayouts((current) => [{ id: crypto.randomUUID(), captainId: selectedCaptain.id, amount, date: "اليوم، الآن", ...keys, note: paymentNote.trim() || `دفعة ${periodLabel}` }, ...current]);
    setIsPayoutOpen(false);
    toast.success(`تم تسجيل دفعة ${formatMoney(amount)} للكابتن ${selectedCaptain.name}.`);
  };
  const navigate = (itemId: string, label: string) => { if (itemId === "home") return setLocation("/"); if (itemId === "more") return setLocation("/more"); if (itemId === "users") return setLocation("/users"); if (itemId === "orders") return setLocation("/logs"); if (itemId !== "fees") toast.info(`واجهة «${label}» ستُبنى عند اختيارك لها.`); };

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
      <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى الرئيسية" onClick={() => setLocation("/")} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور والدفعات</p><h1 className="text-[19px] font-bold leading-6">أجور الكباتن</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><WalletCards size={21} /></span></div></header>
      <main className="px-5 pt-[84px] pb-24">
        <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">دفعات الكباتن حسب التاريخ</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">راجع اليوم أو الأسبوع أو الشهر، ثم سلّم الدفعة للفترة نفسها.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Truck size={23} /></span></div><button type="button" onClick={() => setLocation("/wage-orders")} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8]"><ClipboardList size={17} />كشف كل الطلبات والأجور حسب التاريخ</button></section>
        <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} onPeriodChange={changePeriod} onPeriodKeyChange={setPeriodKey} /></section>
        <section className="mt-4 grid grid-cols-2 gap-3"><article className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CircleDollarSign size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">مستحقات الفترة</p><strong className="mt-1 block text-[18px] text-emerald-700">{formatMoney(totalDue)}</strong><span className="mt-1 text-[10px] text-emerald-700">70% للكباتن</span></article><article className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><Banknote size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">دفعات الفترة</p><strong className="mt-1 block text-[18px] text-[#0060B8]">{formatMoney(totalPaid)}</strong><span className="mt-1 text-[10px] text-[#0060B8]">مسجلة بالتاريخ</span></article></section>
        <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">الكباتن — {periodLabel}</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{periodOrders.length} طلبات</span></div><div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{summaries.map((captain) => { const active = captain.id === selectedCaptain.id; return <button type="button" key={captain.id} onClick={() => setSelectedCaptainId(captain.id)} className={`min-w-[118px] rounded-2xl border p-3 text-right active:scale-[0.97] ${active ? "border-[#0060B8] bg-[#eaf4ff] shadow-[inset_0_0_0_1px_#0060B8]" : "border-[#dbe7f2] bg-white"}`}><span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e5edf3] text-xs font-bold text-[#53616f]">{captain.initial}</span><strong className="text-xs">{captain.name}</strong></span><span className="mt-3 block text-[10px] text-[#66727e]">المتبقي للفترة</span><strong className="mt-1 block text-sm text-emerald-700">{formatMoney(captain.pending)}</strong></button>; })}</div></section>
        <section className="mt-5 rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#e6edf3] font-bold text-[#53616f]">{selectedCaptain.initial}</span><div><h2 className="text-[16px] font-bold">سجل {selectedCaptain.name}</h2><p className="text-[11px] text-[#66727e]">{periodLabel} — {selectedCaptain.orders.length} طلبات</p></div></div><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">70% مستحقه</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-2 text-center"><span className="block text-[10px] text-[#66727e]">حصته</span><strong className="mt-1 block text-xs">{formatMoney(selectedCaptain.due)}</strong></div><div className="rounded-xl bg-blue-50 p-2 text-center"><span className="block text-[10px] text-[#0060B8]">تم تسليمه</span><strong className="mt-1 block text-xs text-[#0060B8]">{formatMoney(selectedCaptain.paid)}</strong></div><div className="rounded-xl bg-emerald-50 p-2 text-center"><span className="block text-[10px] text-emerald-700">المتبقي</span><strong className="mt-1 block text-xs text-emerald-700">{formatMoney(selectedCaptain.pending)}</strong></div></div><button type="button" disabled={selectedCaptain.pending === 0} onClick={openPayout} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,96,184,0.18)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"><Send size={18} />{selectedCaptain.pending === 0 ? "تم تسليم كامل مستحقات الفترة" : "تسليم دفعة للكابتن"}</button></section>
        <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">دفعات {selectedCaptain.name}</h2><span className="text-xs text-[#66727e]">{selectedPayouts.length} دفعات</span></div><div className="space-y-2">{selectedPayouts.length ? selectedPayouts.map((payout) => <article key={payout.id} className="flex items-center justify-between rounded-2xl border border-[#dbe7f2] bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><div><strong className="text-sm">{formatMoney(payout.amount)}</strong><p className="mt-1 text-[11px] text-[#66727e]">{payout.note}</p></div><span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CircleCheckBig size={12} />{payout.date}</span></article>) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-7 text-center text-sm text-[#66727e]">لا توجد دفعات مسجلة لهذه الفترة.</div>}</div></section>
      </main>
      <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">{navItems.map((item) => { const NavIcon = item.icon; const active = item.id === "fees"; return <button type="button" key={item.id} onClick={() => navigate(item.id, item.label)} className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 active:scale-[0.94] ${active ? "-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "text-white hover:bg-white/10"}`} aria-current={active ? "page" : undefined}><NavIcon size={21} strokeWidth={active ? 2.75 : 2.2} fill={active ? "currentColor" : "none"} /><span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span></button>; })}</nav>
      <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}><DialogContent showCloseButton className="max-w-[calc(100%-1.5rem)] rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[390px]" dir="rtl"><DialogHeader className="border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right"><DialogTitle className="pr-7 text-right text-[18px]">تسليم دفعة {periodLabel}</DialogTitle><DialogDescription className="text-right text-xs">الكابتن: {selectedCaptain.name} — المتبقي: {formatMoney(selectedCaptain.pending)}</DialogDescription></DialogHeader><form onSubmit={submitPayout} className="space-y-3 p-4"><label className="block text-xs font-bold text-[#4f5d6b]">مبلغ الدفعة<input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} inputMode="numeric" className="mt-1.5 h-11 w-full rounded-xl border border-[#c9d9e7] bg-white px-3 text-sm focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" /></label><label className="block text-xs font-bold text-[#4f5d6b]">ملاحظة الدفعة<textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="مثال: دفعة يومية" className="mt-1.5 min-h-[78px] w-full resize-none rounded-xl border border-[#c9d9e7] bg-white p-3 text-sm focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" /></label><button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white active:scale-[0.98]"><CircleCheckBig size={18} />تأكيد تسليم الدفعة</button></form></DialogContent></Dialog>
    </div></div>
  );
}
