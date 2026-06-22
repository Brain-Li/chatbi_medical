import { useParams } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
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

const chartColors = ['#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

export default function ReportPreviewPage() {
  const { id } = useParams();
  const report = sampleReportCards.find((item) => item.id === id) ?? sampleReportCards[0];

  return (
    <div className="min-h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <article className="rounded-lg border border-gray-200 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
          <header className="border-b border-gray-100 px-8 py-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  <FileText className="h-3.5 w-3.5" />
                  {report.period}
                </div>
                <h1 className="text-2xl font-semibold text-gray-950">{report.resultTitle}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                  {report.resultSummary}
                </p>
              </div>
              <div className="grid gap-1 text-right text-xs text-gray-500">
                <span>报告编号：{report.reportNo}</span>
                <span>生成时间：{report.generatedAt}</span>
                <span>责任部门：{report.owner}</span>
                <span>统计范围：{report.scope}</span>
              </div>
            </div>
          </header>

          <section className="grid gap-3 px-8 py-5 md:grid-cols-4">
            {report.tableRows.slice(0, 4).map((row) => (
              <div key={row.item} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="text-xs text-gray-500">{row.item}</div>
                <div className="mt-1 text-xl font-semibold text-gray-950">{row.current}</div>
                <div
                  className={`mt-2 text-xs ${
                    row.status === '关注' ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {row.compare} / {row.status}
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 px-8 pb-7 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3 text-sm font-medium text-gray-900">
                {report.chartTitle}
              </div>
              <div className="h-72 px-4 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {report.chartData.map((item, index) => (
                        <Cell
                          key={`${item.name}-${item.value}`}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm font-medium text-gray-900">结构拆解</div>
                <div className="mt-4 space-y-4">
                  {report.structureData.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium text-gray-900">{item.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  异常提示
                </div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                  {report.alerts.map((alert) => (
                    <div key={alert}>{alert}</div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 border-t border-gray-100 px-8 py-7 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="text-sm font-medium text-gray-900">关键结论</div>
              <div className="mt-4 space-y-3">
                {report.findings.map((finding) => (
                  <div key={finding} className="flex items-start gap-2 text-sm leading-6 text-gray-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{finding}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="text-sm font-medium text-gray-900">行动建议</div>
              <div className="mt-4 space-y-3">
                {report.recommendations.map((recommendation, index) => (
                  <div key={recommendation} className="flex items-start gap-3 text-sm leading-6 text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-600">
                      {index + 1}
                    </span>
                    <span>{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-gray-100 px-8 py-7">
            <div className="mb-4 text-sm font-medium text-gray-900">指标明细</div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-3">指标</th>
                    <th className="px-4 py-3">本期值</th>
                    <th className="px-4 py-3">对比变化</th>
                    <th className="px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {report.tableRows.map((row) => (
                    <tr key={row.item}>
                      <td className="px-4 py-3 text-gray-800">{row.item}</td>
                      <td className="px-4 py-3 font-medium text-gray-950">{row.current}</td>
                      <td className="px-4 py-3 text-gray-600">{row.compare}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            row.status === '关注'
                              ? 'bg-amber-50 text-amber-700'
                              : row.status === '改善'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
