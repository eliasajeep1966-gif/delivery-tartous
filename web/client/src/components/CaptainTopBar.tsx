/** Design reminder — Captain header stays compact and white, with calm blue controls matching the admin shell. */
import { Settings } from 'lucide-react';
import { useLocation, Link } from 'wouter';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function CaptainTopBar({ onSignOut, signingOut, showSignOut = false }: { onSignOut: () => void; signingOut: boolean; showSignOut?: boolean }) {
  const [, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[#d8edf7] bg-white/95 px-4 backdrop-blur-xl">
      <Button type="button" variant="ghost" size="icon" aria-label="المساعدة" onClick={() => setLocation('/captain/help')} className="absolute left-3 top-3 h-10 w-10 rounded-xl border border-[#dcecf4] bg-[#f4fbff] text-[#36719a] hover:bg-[#e8f6ff]">
        <span className="text-lg font-black leading-none">i</span>
      </Button>
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-[14px] font-extrabold text-[#075eae]">دليفري طرطوس</p>
        <p className="mt-0.5 text-[10px] font-bold text-[#7b97aa]">حساب الكابتن</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="إعدادات الحساب" className="absolute right-3 top-3 h-10 w-10 rounded-xl border border-[#dcecf4] bg-[#f4fbff] text-[#36719a] hover:bg-[#e8f6ff]"><Settings size={18} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl border-[#d8edf7] p-1.5 text-right">
          <DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/captain/settings#name">تغيير الاسم</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/captain/settings#password">تغيير كلمة السر</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/captain/settings#details">تفاصيل الحساب</Link></DropdownMenuItem>
          {showSignOut && <><DropdownMenuSeparator /><DropdownMenuItem disabled={signingOut} onClick={onSignOut} className="rounded-xl py-2.5 text-red-600 focus:text-red-600">تسجيل الخروج</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
