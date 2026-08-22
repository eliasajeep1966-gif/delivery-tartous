/** Design reminder — Reuse the existing Admin More shell and blue/white mobile hierarchy; this page is navigation-only. */
import { FileWarning } from 'lucide-react';

import { MorePageLayout } from '@/components/MorePageLayout';

export default function AdminCorrections() {
  return (
    <MorePageLayout title="التصحيحات الإدارية" subtitle="لا توجد إجراءات متاحة بعد أو يجري تجهيز هذه الصفحة." Icon={FileWarning}>
      <section className="rounded-2xl border border-[#d3e3f0] bg-white p-6 text-center shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-700">
          <FileWarning size={26} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-[#14213D]">التصحيحات الإدارية</h2>
        <p className="mt-2 text-sm leading-6 text-[#58616b]">لا توجد إجراءات متاحة بعد أو يجري تجهيز هذه الصفحة.</p>
      </section>
    </MorePageLayout>
  );
}
