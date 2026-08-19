/**
 * Design reminder — Reference-inspired Arabic login: soft blue glass surface, distinct input icons, bold #0060B8 CTA, Cairo typography.
 */
import { type FormEvent, useState } from "react";
import { Eye, EyeOff, LogIn, Mail, LockKeyhole } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return toast.error("أدخل البريد الإلكتروني وكلمة المرور.");
    toast.success("تم التحقق من بيانات الدخول ضمن الواجهة.");
    setLocation("/");
  };
  return <AuthShell title="مرحباً بعودتك" subtitle="سجّل الدخول للوصول إلى حسابك"><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-right text-xs font-bold text-[#475663]">البريد الإلكتروني<div className="relative mt-1.5"><Mail className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example.com@" dir="ltr" className="h-14 w-full rounded-xl border border-[#aebbc5] bg-white/95 pr-3 pl-11 text-right text-base text-[#1c2934] shadow-sm placeholder:text-[#9ba8b1] focus:border-[#0060B8] focus:outline-none focus:ring-4 focus:ring-[#0060B8]/10" /></div></label><label className="block text-right text-xs font-bold text-[#475663]">كلمة المرور<div className="relative mt-1.5"><LockKeyhole className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} /><input type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="h-14 w-full rounded-xl border border-[#aebbc5] bg-white/95 pr-11 pl-11 text-base text-[#1c2934] shadow-sm placeholder:text-[#9ba8b1] focus:border-[#0060B8] focus:outline-none focus:ring-4 focus:ring-[#0060B8]/10" /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#60707d] active:scale-95">{visible ? <EyeOff size={21} /> : <Eye size={21} />}</button></div></label><button type="submit" className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0068c6] text-lg font-bold text-white shadow-[0_8px_20px_rgba(0,96,184,0.25)] transition-all duration-150 hover:bg-[#005dab] active:scale-[0.98]"><LogIn size={22} />تسجيل الدخول</button><button type="button" onClick={() => setLocation("/activate")} className="mx-auto block pt-3 text-sm font-bold text-[#0563b4] hover:underline">تفعيل حساب جديد</button></form></AuthShell>;
}
