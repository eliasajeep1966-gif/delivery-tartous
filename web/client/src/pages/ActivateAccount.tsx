/**
 * Design reminder — Reference-inspired Arabic activation: soft blue glass surface, clear password confirmation, #0060B8 CTA, Cairo typography.
 */
import { type FormEvent, useState } from "react";
import { CheckCircle2, LockKeyhole, Mail, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";

export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const field = "h-14 w-full rounded-xl border border-[#aebbc5] bg-white/95 pr-11 pl-3 text-base text-[#1c2934] shadow-sm placeholder:text-[#9ba8b1] focus:border-[#0060B8] focus:outline-none focus:ring-4 focus:ring-[#0060B8]/10";
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!email.trim() || !password.trim() || !confirmation.trim()) return toast.error("أكمل جميع الحقول لتفعيل الحساب."); if (password !== confirmation) return toast.error("تأكيد كلمة المرور غير مطابق."); toast.success("تم تفعيل الحساب ضمن الواجهة. يمكنك تسجيل الدخول الآن."); setLocation("/login"); };
  return <AuthShell title="تفعيل حساب جديد" subtitle="أدخل البريد الإلكتروني وكلمة مرور لحسابك"><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-right text-xs font-bold text-[#475663]">البريد الإلكتروني<div className="relative mt-1.5"><Mail className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example.com@" dir="ltr" className={field} /></div></label><label className="block text-right text-xs font-bold text-[#475663]">كلمة المرور<div className="relative mt-1.5"><LockKeyhole className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className={field} /></div></label><label className="block text-right text-xs font-bold text-[#475663]">تأكيد كلمة المرور<div className="relative mt-1.5"><RotateCcw className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} /><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="••••••••" className={field} /></div></label><button type="submit" className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0068c6] text-lg font-bold text-white shadow-[0_8px_20px_rgba(0,96,184,0.25)] transition-all duration-150 hover:bg-[#005dab] active:scale-[0.98]"><CheckCircle2 size={22} />تفعيل الحساب</button><button type="button" onClick={() => setLocation("/login")} className="mx-auto block pt-3 text-sm font-bold text-[#0563b4] hover:underline">العودة إلى تسجيل الدخول</button><p className="rounded-xl bg-white/60 p-2.5 text-center text-[10px] leading-4 text-[#697986]">لا يمكن تفعيل الحساب إلا بالبريد الإلكتروني المضاف مسبقاً.</p></form></AuthShell>;
}
