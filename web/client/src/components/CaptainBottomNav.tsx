/** Design reminder — Captain navigation mirrors the admin liquid-glass bar while keeping captain-only destinations isolated. */
import { ClipboardList, Home as HomeIcon, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'wouter';

export type CaptainNavKey = 'home' | 'wages' | 'orders' | 'custody';

type CaptainNavItem = { id: Exclude<CaptainNavKey, 'home'>; label: string; icon: typeof WalletCards; path: string };

const sideItems: CaptainNavItem[] = [
  { id: 'custody', label: 'أماناتي', icon: ShieldCheck, path: '/captain/custody' },
  { id: 'orders', label: 'طلباتي', icon: ClipboardList, path: '/captain/orders' },
  { id: 'wages', label: 'أجوري', icon: WalletCards, path: '/captain/wages' },
];

function NavItem({ item, position }: { item: CaptainNavItem; position: 'right-3' | 'right-[25%]' | 'left-[25%]' }) {
  const Icon = item.icon;
  return <Link href={item.path} className={`absolute ${position} top-1/2 z-10 flex h-[64px] w-[64px] -translate-y-1/2 flex-col items-center justify-center rounded-[20px] px-1 py-1 text-[#62798a] transition-colors duration-200 active:scale-[0.96] hover:bg-white/45 hover:text-[#0060B8]`}><span className="grid h-9 min-w-11 place-items-center rounded-[15px] text-[#7f94a4]"><Icon size={20} strokeWidth={2.1} /></span><span className="mt-1 whitespace-nowrap text-[10px] font-bold text-[#62798a]">{item.label}</span></Link>;
}

export function CaptainBottomNav({ active }: { active: CaptainNavKey }) {
  return <nav aria-label="تنقل الكابتن" className="fixed right-3 bottom-3 left-3 z-30 mx-auto h-[76px] w-auto max-w-[429px] overflow-hidden rounded-[28px] border border-white/70 bg-[rgba(239,250,255,0.78)] px-2 pb-1.5 pt-1 text-[#617789] shadow-[0_12px_32px_rgba(0,81,149,0.24),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-2xl before:pointer-events-none before:absolute before:-top-7 before:-bottom-8 before:left-0 before:z-0 before:w-1/3 before:bg-[linear-gradient(105deg,transparent_15%,rgba(255,255,255,0.56)_50%,transparent_84%)]">
    <NavItem item={sideItems[0]} position="right-3" />
    <NavItem item={sideItems[1]} position="right-[25%]" />
    <NavItem item={sideItems[2]} position="left-[25%]" />
    <Link href="/captain" aria-current={active === 'home' ? 'page' : undefined} className={`absolute left-1/2 top-1/2 z-20 flex h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[20px] px-1 py-1 transition-colors duration-200 active:scale-[0.96] ${active === 'home' ? 'text-white' : 'text-[#62798a] hover:bg-white/45 hover:text-[#0060B8]'}`}><span className={`grid h-9 min-w-11 place-items-center rounded-[15px] transition-[background-color,box-shadow,color] duration-300 ${active === 'home' ? 'bg-[linear-gradient(135deg,#0060B8_0%,#159ed8_100%)] text-white shadow-[0_6px_14px_rgba(0,96,184,0.27)]' : 'text-[#7f94a4]'}`}><HomeIcon size={20} strokeWidth={active === 'home' ? 2.65 : 2.1} fill={active === 'home' ? 'currentColor' : 'none'} /></span><span className={`mt-1 whitespace-nowrap text-[10px] font-bold ${active === 'home' ? 'text-[#0059ad]' : 'text-[#62798a]'}`}>الرئيسية</span></Link>
  </nav>;
}
