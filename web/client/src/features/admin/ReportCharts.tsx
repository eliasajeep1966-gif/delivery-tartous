import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatFinanceMoney } from './financeMappers';

export type DailyReportChartPoint = {
  label: string;
  gross: number;
  orderCount: number;
};

export type RevenueSplitPoint = {
  key: 'captains' | 'company';
  label: string;
  value: number;
  color: string;
};

type ReportChartsProps = {
  daily: DailyReportChartPoint[];
  revenueSplit: RevenueSplitPoint[];
};

function formatShortMoney(value: number): string {
  return new Intl.NumberFormat('ar-SY', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function ReportCharts({ daily, revenueSplit }: ReportChartsProps) {
  const total = revenueSplit.reduce((sum, item) => sum + item.value, 0);

  if (daily.length === 0 || total <= 0) {
    return <section className="mt-6 rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-8 text-center text-sm text-[#75818e]">
      لا توجد طلبات مكتملة ضمن الشهر المختار لرسم التقرير.
    </section>;
  }

  return <section className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
    <article className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1f2933]">حركة الأجور اليومية</h2>
          <p className="mt-1 text-[11px] text-[#66727e]">إجمالي أجور الطلبات المكتملة في كل يوم.</p>
        </div>
        <span className="rounded-lg bg-[#eaf4ff] px-2 py-1 text-[10px] font-bold text-[#0060B8]">{daily.length} أيام</span>
      </div>
      <div className="mt-4 h-[236px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daily} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="daily-wages-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1684da" />
                <stop offset="100%" stopColor="#0060B8" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e7eef5" strokeDasharray="3 4" />
            <XAxis axisLine={false} dataKey="label" tick={{ fill: '#75818e', fontSize: 10 }} tickLine={false} />
            <YAxis axisLine={false} tick={{ fill: '#94a3af', fontSize: 10 }} tickFormatter={formatShortMoney} tickLine={false} width={34} />
            <Tooltip
              cursor={{ fill: '#eaf4ff' }}
              contentStyle={{ border: '1px solid #dbe7f2', borderRadius: 12, boxShadow: '0 8px 20px rgba(0,72,141,0.10)', direction: 'rtl', fontSize: 12 }}
              formatter={(value: number | string) => [formatFinanceMoney(Number(value)), 'إجمالي الأجور']}
              labelFormatter={(label) => `اليوم: ${label}`}
            />
            <Bar dataKey="gross" fill="url(#daily-wages-gradient)" maxBarSize={36} name="إجمالي الأجور" radius={[7, 7, 2, 2]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>

    <article className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
      <div>
        <h2 className="text-base font-bold text-[#1f2933]">توزيع الأجور</h2>
        <p className="mt-1 text-[11px] text-[#66727e]">كيف توزّع إجمالي الشهر بين الكباتن والمكتب.</p>
      </div>
      <div className="relative mt-2 h-[180px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ border: '1px solid #dbe7f2', borderRadius: 12, boxShadow: '0 8px 20px rgba(0,72,141,0.10)', direction: 'rtl', fontSize: 12 }}
              formatter={(value: number | string) => formatFinanceMoney(Number(value))}
            />
            <Pie data={revenueSplit} dataKey="value" innerRadius={53} outerRadius={75} paddingAngle={4} stroke="none">
              {revenueSplit.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" dir="rtl">
          <span className="text-[10px] text-[#66727e]">إجمالي الشهر</span>
          <strong className="mt-1 max-w-[104px] text-sm leading-5 text-[#1f2933]">{formatShortMoney(total)} ل.س</strong>
        </div>
      </div>
      <div className="space-y-2 border-t border-[#edf2f6] pt-3">
        {revenueSplit.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;
          return <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 font-bold text-[#4b5563]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
            <span className="text-left"><strong className="text-[#1f2933]">{formatFinanceMoney(item.value)}</strong><span className="mr-1 text-[#75818e]">{percentage}%</span></span>
          </div>;
        })}
      </div>
    </article>
  </section>;
}
