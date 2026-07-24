import { useParams } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { sampleReportCards } from '../sampleReports';

const chartColors = ['#165dff', '#4080ff', '#6aa1ff', '#94bfff', '#bedaff'];
const AI_REPORT_DISCLAIMER = '内容由 AI 生成，仅供参考，无法保证完全真实';

function formatMetricValue(label: string, value: string) {
  return label.endsWith('收入') && !/^[¥￥]/.test(value) ? `¥${value}` : value;
}

function getTrendLabel(compare: string) {
  if (/^-|下降|减少|降低/.test(compare)) return '↓ 下降';
  if (/^\+|提升|增加|增长|上升/.test(compare)) return '↑ 上升';
  return `— ${compare}`;
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="border-b border-[#e5e6eb] pb-1.5 pt-4 text-[18px] font-medium leading-[26px] text-[#1d2129]">{title}</h2>
      <div className="mt-2 max-w-[760px] space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2.5 text-sm font-normal leading-6 text-[#4e5969]">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#165dff]" aria-hidden="true" />
            <span className="min-w-0">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReportPreviewPage() {
  const { id } = useParams();
  const report = sampleReportCards.find((item) => item.id === id) ?? sampleReportCards[0];
  const chartDescription = report.chartData
    .map((item) => `${item.name}${item.value}`)
    .join('，');

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#f7f8fa] px-6 py-8">
      <article className="mx-auto max-w-[1080px] overflow-hidden rounded-[12px] border border-[#e5e6eb] bg-white shadow-[0_2px_8px_rgba(29,33,41,0.05)]">
        <div className="mx-auto max-w-[960px] px-8 py-8 text-sm font-normal leading-6 text-[#4e5969]">
          <h1 className="pb-1 text-[22px] font-medium leading-8 text-[#1d2129]">{report.resultTitle}</h1>
          <p className="mt-2">统计周期：{report.period}</p>

          <section>
            <h2 className="border-b border-[#e5e6eb] pb-1.5 pt-4 text-[18px] font-medium leading-[26px] text-[#1d2129]">核心结论</h2>
            <p className="mt-2 max-w-[760px]">{report.resultSummary}</p>
          </section>

          <section>
            <h2 className="border-b border-[#e5e6eb] pb-1.5 pt-4 text-[18px] font-medium leading-[26px] text-[#1d2129]">数据概览</h2>
            <div className="mt-4 grid grid-cols-2 gap-3" aria-label="关键指标卡片">
              {report.tableRows.slice(0, 4).map((row) => (
                <div key={row.item} className="min-w-0 rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] px-3.5 py-3">
                  <div className="truncate text-xs leading-[18px] text-[#86909c]" title={row.item}>{row.item}</div>
                  <div className="mt-1 truncate text-xl font-semibold leading-7 text-[#1d2129]" title={row.current}>
                    {formatMetricValue(row.item, row.current)}
                  </div>
                  <div className="mt-1 text-xs leading-[18px] text-[#4e5969]">{getTrendLabel(row.compare)}</div>
                </div>
              ))}
            </div>

            <section className="mt-4 overflow-hidden rounded-[10px] border border-[#e5e6eb] bg-white" aria-labelledby="sample-report-chart-title">
              <h3 id="sample-report-chart-title" className="border-b border-[#f2f3f5] bg-[#f7f8fa] px-4 py-2.5 text-sm font-medium leading-[22px] text-[#1d2129]">{report.chartTitle}</h3>
              <div className="h-[250px] px-3 pb-2 pt-4" role="img" aria-label={`${report.chartTitle}柱状图：${chartDescription}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.chartData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      height={38}
                      tick={{ fontSize: 11, fill: '#86909c' }}
                      tickFormatter={(value) => {
                        const label = String(value);
                        return label.length > 7 ? `${label.slice(0, 7)}…` : label;
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} width={48} tick={{ fontSize: 11, fill: '#86909c' }} />
                    <Tooltip
                      cursor={{ fill: '#f7f8fa' }}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e5e6eb',
                        boxShadow: '0 6px 16px rgba(29, 33, 41, 0.10)',
                      }}
                    />
                    <Bar dataKey="value" name="指标值" radius={[5, 5, 0, 0]} maxBarSize={52}>
                      {report.chartData.map((item, index) => (
                        <Cell key={`${item.name}-${item.value}-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </section>

          <BulletSection title="关键发现" items={report.findings} />
          <BulletSection title="风险提示" items={report.alerts} />
          <BulletSection title="分析依据" items={report.analysisBasis} />
        </div>
        <div className="bg-white px-4 py-2 text-center text-xs leading-4 text-[#a8abb2]" role="note">
          {AI_REPORT_DISCLAIMER}
        </div>
      </article>
    </div>
  );
}
