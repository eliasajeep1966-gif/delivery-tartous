/**
 * Design reminder — Reference-inspired Arabic auth shell: luminous icy-blue panels, soft glass card, brand-blue action, Cairo typography.
 */
import type { ReactNode } from "react";

type AuthShellProps = { title: string; subtitle: string; children: ReactNode };

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#dceefa] px-4 py-8" dir="rtl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.95),transparent_29%),radial-gradient(circle_at_90%_75%,rgba(88,177,234,0.3),transparent_34%),linear-gradient(145deg,#d8edf9_0%,#f5fbff_48%,#c9e7f8_100%)]" />
      <div className="pointer-events-none absolute -top-16 -right-20 h-64 w-64 rounded-full border-[22px] border-white/25" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full border-[30px] border-[#0060B8]/10" />
      <main className="relative w-full max-w-[410px] rounded-[32px] border border-white/75 bg-white/55 p-5 shadow-[0_25px_70px_rgba(0,89,160,0.18)] backdrop-blur-xl sm:p-7">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-[26px] border border-white/80 bg-white p-1.5 shadow-[0_10px_26px_rgba(0,96,184,0.15)]">
            <img src="/assets/delivery-tartous-office-logo.jpg" alt="شعار دليفري طرطوس" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 text-[25px] font-bold tracking-[-0.45px] text-[#075ba6]">دليفري طرطوس</h1>
          <h2 className="mt-5 text-[21px] font-bold text-[#1c2934]">{title}</h2>
          <p className="mt-1.5 text-sm text-[#62717e]">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
