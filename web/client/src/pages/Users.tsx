/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL admin workspace, #0060B8 operational blue, clear white cards, Cairo Arabic type, no gradients.
 */
import { type FormEvent, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CircleUserRound,
  FileText,
  Home as HomeIcon,
  Mail,
  Menu,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserRole = "admin" | "supervisor" | "captain";

type AppUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  otherDetails: string;
  custody: string;
};

const roleMeta: Record<UserRole, { label: string; cardClass: string; icon: typeof ShieldCheck }> = {
  admin: { label: "أدمن", cardClass: "bg-violet-50 text-violet-700 border-violet-100", icon: ShieldCheck },
  supervisor: { label: "مشرف", cardClass: "bg-blue-50 text-[#0060B8] border-blue-100", icon: CircleUserRound },
  captain: { label: "كابتن", cardClass: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: Truck },
};

const initialUsers: AppUser[] = [
  { id: "user-1", name: "إيلي جيب", email: "elie@delivery-tartous.com", phone: "0933000000", role: "admin", otherDetails: "إدارة النظام كاملة", custody: "" },
  { id: "user-2", name: "هشام علي", email: "hisham@delivery-tartous.com", phone: "0933000004", role: "supervisor", otherDetails: "مناوبة صباحية", custody: "" },
  { id: "user-3", name: "محمد علي", email: "mohammad@delivery-tartous.com", phone: "0933000001", role: "captain", otherDetails: "يعمل ضمن مركز طرطوس", custody: "حقيبة حرارية\nهاتف العمل\nوصلة شحن" },
  { id: "user-4", name: "حسن يوسف", email: "hassan@delivery-tartous.com", phone: "0933000002", role: "captain", otherDetails: "متاح للمناوبات المسائية", custody: "حقيبة حرارية\nسترة دليفري" },
];

const createDraft = (): AppUser => ({
  id: crypto.randomUUID(),
  name: "",
  email: "",
  phone: "",
  role: "captain",
  otherDetails: "",
  custody: "",
});

const navItems = [
  { id: "more", label: "المزيد", icon: Menu },
  { id: "orders", label: "الطلبات", icon: Package },
  { id: "home", label: "الرئيسية", icon: HomeIcon },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "fees", label: "الأجور", icon: WalletCards },
];

export default function Users() {
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState(initialUsers);
  const [draft, setDraft] = useState<AppUser>(createDraft);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const updateDraft = <Field extends keyof AppUser>(field: Field, value: AppUser[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleDialogState = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setDraft(createDraft());
  };

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.email.trim() || !draft.phone.trim()) {
      toast.error("أدخل الاسم والبريد الإلكتروني ورقم الهاتف.");
      return;
    }

    setUsers((current) => [{ ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() }, ...current]);
    toast.success(`تمت إضافة المستخدم ${draft.name.trim()} إلى القائمة.`);
    handleDialogState(false);
  };

  const deleteUser = () => {
    if (!deleteTarget) return;
    setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
    toast.success(`تم حذف المستخدم ${deleteTarget.name}.`);
    setDeleteTarget(null);
  };

  const handleNavigation = (itemId: string, label: string) => {
    if (itemId === "home") {
      setLocation("/");
      return;
    }
    if (itemId === "more") {
      setLocation("/more");
      return;
    }
    if (itemId === "orders") {
      setLocation("/logs");
      return;
    }
    if (itemId === "fees") {
      setLocation("/wages");
      return;
    }
    if (itemId !== "users") toast.info(`واجهة «${label}» ستُبنى عند اختيارك لها.`);
  };

  const fieldClass = "h-11 w-full rounded-xl border border-[#c9d9e7] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15";

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <button
            type="button"
            aria-label="العودة إلى الرئيسية"
            onClick={() => setLocation("/")}
            className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]"
          >
            <ArrowRight size={22} strokeWidth={2.4} />
          </button>
          <div className="flex items-center gap-2">
            <div className="text-left">
              <p className="text-[11px] leading-4 text-[#dbeaff]">لوحة الأدمن</p>
              <h1 className="text-[19px] font-bold leading-6">إدارة المستخدمين</h1>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><UsersRound size={21} /></span>
          </div>
        </header>

        <main className="px-5 pt-[84px] pb-24">
          <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold">إدارة المستخدمين</h2>
                <p className="mt-1 text-xs leading-5 text-[#58616b]">أضف المستخدمين وحدد أدوارهم وبيانات الكباتن.</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><UserRound size={23} /></span>
            </div>
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,96,184,0.18)] transition-all duration-150 hover:bg-[#0057a7] active:scale-[0.98]"
            >
              <Plus size={19} strokeWidth={2.6} />
              إضافة مستخدم جديد
            </button>
          </section>

          <section className="mt-6" aria-labelledby="users-list-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="users-list-title" className="text-base font-bold">المستخدمون الحاليون</h2>
              <span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{users.length} مستخدمين</span>
            </div>

            <div className="space-y-3">
              {users.map((user) => {
                const meta = roleMeta[user.role];
                const RoleIcon = meta.icon;
                return (
                  <article key={user.id} className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7edf2] text-sm font-bold text-[#52606d]">{user.name.slice(0, 1)}</span>
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-bold">{user.name}</h3>
                          <span className={`mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${meta.cardClass}`}><RoleIcon size={13} />{meta.label}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        aria-label={`حذف المستخدم ${user.name}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-100 bg-red-50 text-[#ba1a1a] transition-colors hover:bg-red-100 active:scale-[0.96]"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <dl className="mt-3 space-y-2 border-t border-[#eef3f7] pt-3 text-xs">
                      <div className="flex items-center gap-2 text-[#4f5d6b]"><Mail size={15} className="text-[#66727e]" /><dd className="min-w-0 truncate" dir="ltr">{user.email}</dd></div>
                      <div className="flex items-center gap-2 text-[#4f5d6b]"><Phone size={15} className="text-[#66727e]" /><dd dir="ltr">{user.phone}</dd></div>
                      {user.otherDetails && <div className="flex items-start gap-2 text-[#4f5d6b]"><FileText size={15} className="mt-0.5 shrink-0 text-[#66727e]" /><dd>{user.otherDetails}</dd></div>}
                      {user.role === "captain" && (
                        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[#76511a]">
                          <dt className="mb-1 text-[11px] font-bold">الأمانات المستلمة</dt>
                          <dd className="whitespace-pre-line leading-5">{user.custody.trim() || "لا توجد أمانات مسجلة."}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        </main>

        <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">
          {navItems.map((item) => {
            const NavIcon = item.icon;
            const isActive = item.id === "users";
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => handleNavigation(item.id, item.label)}
                className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-[0.94] ${isActive ? "-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "text-white hover:bg-white/10"}`}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon size={21} strokeWidth={isActive ? 2.75 : 2.2} fill={isActive ? "currentColor" : "none"} />
                <span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogState}>
          <DialogContent showCloseButton className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
            <DialogHeader className="sticky top-0 z-10 border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right shadow-[0_2px_7px_rgba(0,72,141,0.04)]">
              <DialogTitle className="pr-7 text-right text-[19px] text-[#1c1b1b]">إضافة مستخدم جديد</DialogTitle>
              <DialogDescription className="text-right text-xs text-[#58616b]">أدخل البيانات الأساسية وحدد دور المستخدم.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateUser} className="space-y-3 p-4">
              <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                <h3 className="mb-3 text-sm font-bold">البيانات الأساسية</h3>
                <div className="space-y-2.5">
                  <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} type="email" placeholder="البريد الإلكتروني للمستخدم الجديد" className={fieldClass} required />
                  <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="الاسم الكامل" className={fieldClass} required />
                  <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} inputMode="tel" placeholder="رقم الهاتف" className={fieldClass} required />
                  <textarea value={draft.otherDetails} onChange={(event) => updateDraft("otherDetails", event.target.value)} placeholder="بيانات أخرى (اختياري)" className="min-h-[76px] w-full resize-none rounded-xl border border-[#c9d9e7] bg-white p-3 text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" />
                </div>
              </section>

              <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                <h3 className="mb-3 text-sm font-bold">الدور</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(roleMeta) as UserRole[]).map((role) => {
                    const meta = roleMeta[role];
                    const RoleIcon = meta.icon;
                    const isActive = draft.role === role;
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => updateDraft("role", role)}
                        className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-[0.97] ${isActive ? "border-[#0060B8] bg-[#eaf4ff] text-[#0060B8] shadow-[inset_0_0_0_1px_#0060B8]" : "border-[#dce6ef] bg-white text-[#64717e] hover:bg-[#f7fbff]"}`}
                      >
                        <RoleIcon size={18} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {draft.role === "captain" && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-[#76511a]"><Truck size={18} /><h3 className="text-sm font-bold">الأمانات</h3></div>
                  <p className="mb-2 text-[11px] leading-4 text-[#8a682c]">اكتب الأشياء المستلمة. اجعل كل غرض في سطر مستقل.</p>
                  <textarea value={draft.custody} onChange={(event) => updateDraft("custody", event.target.value)} placeholder={"مثال:\nحقيبة حرارية\nهاتف العمل"} className="min-h-[112px] w-full resize-none rounded-xl border border-amber-200 bg-white p-3 text-sm text-[#4e3b14] placeholder:text-[#a48751] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15" />
                </section>
              )}

              <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,96,184,0.22)] transition-all duration-150 hover:bg-[#0057a7] active:scale-[0.98]"><Plus size={19} strokeWidth={2.6} />إضافة المستخدم</button>
              <p className="pb-1 text-center text-[10px] leading-4 text-[#66727e]">الإضافة تجريبية ضمن الواجهة حالياً.</p>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl border-[#f0c7c2] bg-white p-5 text-right sm:max-w-[380px]" dir="rtl">
            <AlertDialogHeader className="text-right">
              <AlertDialogTitle className="text-right text-[18px] text-[#1c1b1b]">حذف المستخدم؟</AlertDialogTitle>
              <AlertDialogDescription className="text-right leading-6">سيُحذف المستخدم <strong className="text-[#1c1b1b]">{deleteTarget?.name}</strong> من قائمة المستخدمين. هل تريد المتابعة؟</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-2 flex-row-reverse justify-start gap-2 sm:flex-row-reverse sm:justify-start">
              <AlertDialogAction onClick={deleteUser} className="h-10 rounded-xl bg-[#ba1a1a] px-4 text-white hover:bg-[#9d1515]">حذف المستخدم</AlertDialogAction>
              <AlertDialogCancel className="mt-0 h-10 rounded-xl border-[#dbe7f2] bg-white px-4 text-[#4f5d6b] hover:bg-[#f5f9fc]">إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
