import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, Download } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { sampleReportCards } from '../sampleReports';

const AI_REPORT_DISCLAIMER = '内容由 AI 生成，仅供参考，无法保证完全真实';
const stackedChartData = [
  { name: '药品', primary: 350, secondary: 650 },
  { name: '检查', primary: 500, secondary: 320 },
  { name: '治疗', primary: 260, secondary: 450 },
  { name: '耗材', primary: 560, secondary: 140 },
  { name: '挂号', primary: 510, secondary: 180 },
  { name: '检验', primary: 350, secondary: 290 },
  { name: '手术', primary: 290, secondary: 350 },
  { name: '康复', primary: 470, secondary: 170 },
  { name: '其他', primary: 250, secondary: 160 },
];

function formatMetricValue(label: string, value: string) {
  return label.endsWith('收入') && !/^[¥￥]/.test(value) ? `¥${value}` : value;
}

function isDownTrend(compare: string) {
  return /^-|下降|减少|降低/.test(compare);
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-t border-[#e5e6eb] pt-4">
      <h2 className="text-[14px] font-medium leading-6 text-[#1d2129]">{title}</h2>
      <ul className="mt-3 list-disc space-y-0 pl-[21px] text-[14px] font-normal leading-7 text-[#4e5969]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function ReportPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const report = sampleReportCards.find((item) => item.id === id) ?? sampleReportCards[0];
  const reportFileName = `${report.resultTitle.replace(/[\\/:*?"<>|]/g, '_') || 'report'}.md`;
  const reportMarkdown = [
    `# ${report.resultTitle}`,
    '',
    `统计周期：${report.period}`,
    '',
    '## 核心结论',
    '',
    report.resultSummary,
    '',
    '## 数据概览',
    '',
    '| 指标 | 当前值 | 对比 | 状态 |',
    '| --- | ---: | ---: | --- |',
    ...report.tableRows.slice(0, 4).map((row) => (
      `| ${row.item} | ${formatMetricValue(row.item, row.current)} | ${row.compare} | ${row.status} |`
    )),
    '',
    '## 关键发现',
    '',
    ...report.findings.map((item) => `- ${item}`),
    '',
    '## 风险提示',
    '',
    ...report.alerts.map((item) => `- ${item}`),
    '',
    '## 分析依据',
    '',
    ...report.analysisBasis.map((item) => `- ${item}`),
    '',
    `> ${AI_REPORT_DISCLAIMER}`,
  ].join('\n');
  const reportDownloadHref = `data:text/markdown;charset=utf-8,${encodeURIComponent(reportMarkdown)}`;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-white font-['PingFang_SC','Microsoft_YaHei',sans-serif]">
      <article className="relative min-h-[1247px] px-5 py-6 text-[14px] font-normal leading-[22px] text-[#4e5969] sm:px-8 lg:px-10">
        <header className="flex items-start justify-between gap-4 border-b border-[#e5e6eb] pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <UiTooltip delayDuration={240}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    aria-label="返回首页"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#f7f8fa] text-[#4e5969] transition-colors hover:bg-[#e5e6eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"
                  >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={8}
                  showArrow={false}
                  className="relative rounded-[4px] border-0 bg-[#1d2129] px-2.5 py-1 text-xs font-normal leading-[18px] whitespace-nowrap text-white shadow-[0_6px_16px_rgba(29,33,41,0.16)]"
                >
                  返回
                  <span aria-hidden="true" className="absolute bottom-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[4px] border-x-transparent border-b-[#1d2129]" />
                </TooltipContent>
              </UiTooltip>
              <h1 className="truncate text-[16px] font-medium leading-6 text-[#1d2129]">{report.resultTitle}</h1>
            </div>
            <p className="mt-2 leading-[22px]">统计周期：{report.period}</p>
          </div>
          <UiTooltip delayDuration={240}>
            <TooltipTrigger asChild>
              <a
                href={reportDownloadHref}
                download={reportFileName}
                aria-label="下载报告"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#f7f8fa] text-[#4e5969] transition-colors hover:bg-[#e5e6eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"
              >
                <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              </a>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              showArrow={false}
              collisionPadding={8}
              className="relative rounded-[4px] border-0 bg-[#1d2129] px-2.5 py-1 text-xs font-normal leading-[18px] whitespace-nowrap text-white shadow-[0_6px_16px_rgba(29,33,41,0.16)]"
            >
              下载报告
              <span aria-hidden="true" className="absolute bottom-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[4px] border-x-transparent border-b-[#1d2129]" />
            </TooltipContent>
          </UiTooltip>
        </header>

        <section className="border-b border-[#e5e6eb] py-4">
          <h2 className="text-[14px] font-medium leading-6 text-[#1d2129]">核心结论</h2>
          <p className="mt-3">{report.resultSummary}</p>
        </section>

        <section className="pt-4">
          <h2 className="text-[14px] font-medium leading-6 text-[#1d2129]">数据概览</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="关键指标卡片">
            {report.tableRows.slice(0, 4).map((row) => {
              const down = isDownTrend(row.compare);

              return (
                <div key={row.item} className="flex min-h-[59px] min-w-0 flex-col justify-center rounded-[8px] bg-[#f7f8fa] px-2 py-1.5">
                  <div className="truncate leading-5" title={row.item}>{row.item}</div>
                  <div className="mt-1 flex min-w-0 items-center gap-1">
                    <span className="truncate leading-[22px]" title={row.current}>{formatMetricValue(row.item, row.current)}</span>
                    <span
                      className={`inline-flex h-[21px] shrink-0 items-center gap-px rounded-[4px] px-1.5 text-[12px] leading-5 ${
                        down ? 'bg-[#e8ffea] text-[#00b42a]' : 'bg-[#ffece8] text-[#f53f3f]'
                      }`}
                    >
                      {down ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                      {down ? '下降' : '上升'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="mt-4 h-[324px] overflow-hidden rounded-[8px] border border-[#e5e6eb] bg-white" aria-labelledby="sample-report-chart-title">
            <div className="flex h-10 items-center justify-between border-b border-[#e5e6eb] bg-[#f7f8fa] px-4">
              <h3 id="sample-report-chart-title" className="text-[14px] font-medium leading-[22px] text-[#1d2129]">关键经营指标</h3>
              <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#e8f3ff] text-[#165dff]" aria-hidden="true">
                <BarChart3 className="h-4 w-4" strokeWidth={2.2} />
              </span>
            </div>
            <div className="relative h-[284px] px-3 pb-2 pt-11" role="img" aria-label="关键经营指标堆叠柱状图">
              <span className="absolute left-4 top-4 text-[12px] leading-5 text-[#4e5969]">纵轴标题</span>
              <div className="absolute right-4 top-4 flex items-center gap-5 text-[12px] leading-5 text-[#4e5969]" aria-hidden="true">
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-[#165dff]" />Legend</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-[#0fc6c2]" />Legend</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedChartData} barCategoryGap="18%" margin={{ top: 0, right: 2, bottom: 0, left: -6 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e5e6eb" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={{ stroke: '#c9cdd4' }}
                    tickLine={false}
                    tickMargin={9}
                    height={30}
                    tick={{ fontSize: 12, fill: '#4e5969' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={46}
                    domain={[0, 1000]}
                    ticks={[0, 200, 400, 600, 800, 1000]}
                    tick={{ fontSize: 12, fill: '#86909c' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f7f8fa' }}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e6eb',
                      boxShadow: '0 6px 16px rgba(29, 33, 41, 0.10)',
                    }}
                  />
                  <Bar dataKey="primary" name="Legend" stackId="total" fill="#165dff" isAnimationActive={false} />
                  <Bar dataKey="secondary" name="Legend" stackId="total" fill="#0fc6c2" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </section>

        <div className="mt-4 space-y-4 pb-16">
          <BulletSection title="关键发现" items={report.findings} />
          <BulletSection title="风险提示" items={report.alerts} />
          <BulletSection title="分析依据" items={report.analysisBasis} />
        </div>

        <p className="absolute inset-x-5 bottom-4 text-center text-[14px] leading-7 text-[#86909c] sm:inset-x-8 lg:inset-x-10" role="note">
          {AI_REPORT_DISCLAIMER}
        </p>
      </article>
    </div>
  );
}
