export type SampleReportCard = {
  id: string;
  title: string;
  description: string;
  agentId: string;
  templateId: string;
  question: string;
  resultTitle: string;
  period: string;
  resultSummary: string;
  tags: string[];
  metrics: Array<{ label: string; value: string }>;
  icon: 'daily' | 'weekly' | 'monthly' | 'holiday';
  iconClassName: string;
  reportNo: string;
  generatedAt: string;
  owner: string;
  scope: string;
  chartTitle: string;
  chartData: Array<{ name: string; value: number }>;
  structureData: Array<{ label: string; value: string; percent: number }>;
  findings: string[];
  alerts: string[];
  analysisBasis: string[];
  recommendations: string[];
  tableRows: Array<{
    item: string;
    current: string;
    compare: string;
    status: string;
  }>;
};

export const sampleReportCards: SampleReportCard[] = [
  {
    id: 'outpatient-daily',
    title: '门诊经营日报',
    description: '汇总昨日门诊量、收入、药占比和重点科室表现，快速定位需要关注的异常项。',
    agentId: 'agent-report-daily',
    templateId: 'template-operation-daily',
    question: '生成昨天的门诊经营日报。',
    resultTitle: '门诊经营日报',
    period: '昨日',
    resultSummary: '昨日门诊经营整体平稳，门诊收入和门诊量均较近 7 日均值提升，检查收入贡献明显。',
    tags: ['日报', '门诊', '异常提示'],
    metrics: [
      { label: '门诊收入', value: '482.6万' },
      { label: '门诊量', value: '12,483' },
    ],
    icon: 'daily',
    iconClassName: 'bg-blue-50 text-blue-600',
    reportNo: 'RPT-OPD-20260521',
    generatedAt: '2026-05-22 08:10',
    owner: '经营管理部',
    scope: '全院门诊',
    chartTitle: '昨日分时段门诊收入',
    chartData: [
      { name: '08:00', value: 62 },
      { name: '10:00', value: 96 },
      { name: '12:00', value: 72 },
      { name: '14:00', value: 88 },
      { name: '16:00', value: 104 },
    ],
    structureData: [
      { label: '检查收入', value: '109.8万', percent: 78 },
      { label: '药品收入', value: '151.6万', percent: 64 },
      { label: '治疗收入', value: '83.2万', percent: 48 },
    ],
    findings: [
      '门诊收入较近 7 日均值提升 6.8%，主要来自眼科、骨科检查项目增长。',
      '门诊量在 10:00 和 16:00 形成双峰，上午窗口排队压力较高。',
      '药占比保持下降趋势，费用结构较上周更健康。',
    ],
    alerts: [
      '高值耗材门诊组连续两日超过提醒阈值。',
      '检查收入增速高于门诊量增速，需要复核项目结构变化。',
    ],
    analysisBasis: [
      '门诊经营数据集，用于汇总门诊量、收入、药占比和检查收入。',
      '近 7 日门诊经营基线，用于校验昨日指标变化。',
      '科室收入结构分析，用于定位眼科、骨科及检查项目贡献。',
    ],
    recommendations: [
      '复核眼科检查项目增长来源，区分真实需求和套餐结构变化。',
      '优化上午高峰窗口排班，优先保障挂号、缴费和检查引导。',
      '跟踪高值耗材门诊组，必要时纳入专题复核。',
    ],
    tableRows: [
      { item: '门诊收入', current: '482.6万', compare: '+6.8%', status: '正常' },
      { item: '门诊量', current: '12,483', compare: '+4.2%', status: '正常' },
      { item: '药占比', current: '31.4%', compare: '-1.6pp', status: '改善' },
      { item: '检查收入', current: '109.8万', compare: '+12.5%', status: '关注' },
    ],
  },
  {
    id: 'emergency-weekly',
    title: '门急诊运营周报',
    description: '按周复盘门急诊流量、收入趋势和资源使用情况，沉淀管理层可读的经营结论。',
    agentId: 'agent-report-daily',
    templateId: 'template-operation-daily',
    question: '给我做一份本周门急诊周报。',
    resultTitle: '门急诊运营周报',
    period: '本周',
    resultSummary: '本周门急诊量稳中有升，急诊夜间流量增加，收入增长主要来自检查和治疗项目。',
    tags: ['周报', '门急诊', '趋势复盘'],
    metrics: [
      { label: '周门急诊量', value: '7.8万' },
      { label: '收入环比', value: '+6.4%' },
    ],
    icon: 'weekly',
    iconClassName: 'bg-emerald-50 text-emerald-600',
    reportNo: 'RPT-ERW-202605W3',
    generatedAt: '2026-05-22 09:00',
    owner: '门急诊办公室',
    scope: '全院门急诊',
    chartTitle: '本周门急诊量趋势',
    chartData: [
      { name: '周一', value: 108 },
      { name: '周二', value: 116 },
      { name: '周三', value: 121 },
      { name: '周四', value: 118 },
      { name: '周五', value: 126 },
    ],
    structureData: [
      { label: '门诊收入', value: '2,384万', percent: 72 },
      { label: '急诊收入', value: '416万', percent: 44 },
      { label: '检查收入', value: '682万', percent: 63 },
    ],
    findings: [
      '本周门急诊量环比增长 5.1%，周三后段流量持续走高。',
      '急诊夜间流量占比提升，主要集中在儿科和内科。',
      '收入环比增长 6.4%，高于流量增速，结构贡献来自检查项目。',
    ],
    alerts: [
      '急诊夜间候诊时长较上周增加 9 分钟。',
      '儿科夜间接诊压力持续偏高，需要关注排班弹性。',
    ],
    analysisBasis: [
      '门急诊运营数据集，用于汇总本周流量、收入和资源使用情况。',
      '门急诊量周趋势分析，用于识别工作日流量变化。',
      '夜间接诊与候诊数据，用于校验急诊资源压力。',
    ],
    recommendations: [
      '补充急诊夜间导诊和检验窗口资源。',
      '对儿科夜间高峰进行分时预约和预检分流。',
      '将检查项目增长拆分到科室和项目维度复核。',
    ],
    tableRows: [
      { item: '周门急诊量', current: '7.8万', compare: '+5.1%', status: '正常' },
      { item: '收入环比', current: '+6.4%', compare: '+1.3pp', status: '正常' },
      { item: '夜间候诊', current: '38分钟', compare: '+9分钟', status: '关注' },
      { item: '急诊收入', current: '416万', compare: '+8.2%', status: '正常' },
    ],
  },
  {
    id: 'operation-monthly',
    title: '月度经营分析',
    description: '面向经营例会输出月度指标、同比环比、结构拆解和管理建议。',
    agentId: 'agent-report-daily',
    templateId: 'template-dept-monthly',
    question: '输出本月经营月报并突出异常项。',
    resultTitle: '月度经营分析报告',
    period: '本月',
    resultSummary: '本月经营收入保持增长，但部分科室费用结构波动较大，需要做专题复核。',
    tags: ['月报', '经营分析', '同比环比'],
    metrics: [
      { label: '经营收入', value: '3,286万' },
      { label: '异常项', value: '5项' },
    ],
    icon: 'monthly',
    iconClassName: 'bg-violet-50 text-violet-600',
    reportNo: 'RPT-MON-202605',
    generatedAt: '2026-05-31 18:30',
    owner: '财务运营组',
    scope: '全院经营',
    chartTitle: '月度经营收入趋势',
    chartData: [
      { name: '第1周', value: 724 },
      { name: '第2周', value: 781 },
      { name: '第3周', value: 842 },
      { name: '第4周', value: 939 },
    ],
    structureData: [
      { label: '门诊收入', value: '1,286万', percent: 58 },
      { label: '住院收入', value: '1,742万', percent: 76 },
      { label: '检查治疗', value: '958万', percent: 61 },
    ],
    findings: [
      '月度经营收入环比增长 7.2%，住院收入贡献最大。',
      '骨科和眼科贡献主要增量，儿科收入低于月初目标。',
      '费用结构中耗材占比抬升，需要关注高值耗材使用变化。',
    ],
    alerts: [
      '5 项异常指标中，3 项集中在耗材和检查项目。',
      '儿科收入达成率 91.6%，低于全院平均水平。',
    ],
    analysisBasis: [
      '全院月度经营数据集，用于计算收入、结构和目标达成情况。',
      '科室收入结构分析，用于拆解主要增量和未达目标科室。',
      '耗材与检查项目监测规则，用于识别费用结构异常。',
    ],
    recommendations: [
      '对耗材占比抬升科室发起专项复核。',
      '拆分儿科收入未达目标原因，区分流量和客单价影响。',
      '将骨科增量经验沉淀为下月重点观察模板。',
    ],
    tableRows: [
      { item: '经营收入', current: '3,286万', compare: '+7.2%', status: '正常' },
      { item: '住院收入', current: '1,742万', compare: '+8.9%', status: '正常' },
      { item: '耗占比', current: '18.2%', compare: '+2.1pp', status: '关注' },
      { item: '异常项', current: '5项', compare: '+2项', status: '关注' },
    ],
  },
  {
    id: 'holiday-operation',
    title: '节假日运营专题',
    description: '围绕节假日前后就诊峰谷、科室承压和收入结构变化做专题复盘。',
    agentId: 'agent-report-daily',
    templateId: 'template-operation-daily',
    question: '做一个节假日运营专题分析。',
    resultTitle: '节假日运营专题报告',
    period: '节假日专题',
    resultSummary: '节假日前后就诊峰谷明显，部分科室承压突出，建议提前进行分时资源配置。',
    tags: ['专题', '节假日', '资源调度'],
    metrics: [
      { label: '峰值时段', value: '10:00' },
      { label: '承压科室', value: '3个' },
    ],
    icon: 'holiday',
    iconClassName: 'bg-amber-50 text-amber-600',
    reportNo: 'RPT-HOLIDAY-202605',
    generatedAt: '2026-05-06 10:20',
    owner: '运营调度组',
    scope: '节假日门急诊',
    chartTitle: '节假日前后就诊峰谷',
    chartData: [
      { name: '节前2日', value: 92 },
      { name: '节前1日', value: 118 },
      { name: '节日', value: 76 },
      { name: '节后1日', value: 134 },
      { name: '节后2日', value: 121 },
    ],
    structureData: [
      { label: '内科', value: '31%', percent: 72 },
      { label: '儿科', value: '24%', percent: 58 },
      { label: '急诊', value: '18%', percent: 45 },
    ],
    findings: [
      '节后首日出现明显就诊回补，峰值集中在 10:00-11:30。',
      '内科、儿科和急诊为主要承压科室。',
      '检查和药品收入在节后两日恢复较快。',
    ],
    alerts: [
      '节后首日上午窗口候诊压力高于平日 22%。',
      '儿科候诊时长和投诉风险同步上升。',
    ],
    analysisBasis: [
      '节假日前后门急诊数据集，用于比较就诊峰谷和收入变化。',
      '科室承压分析，用于识别内科、儿科和急诊资源压力。',
      '分时段候诊数据，用于校验节后首日高峰风险。',
    ],
    recommendations: [
      '节后首日增加导诊、挂号和检验窗口人员。',
      '对内科和儿科设置分时段加号策略。',
      '提前发布节假日就诊提醒，降低集中到院压力。',
    ],
    tableRows: [
      { item: '峰值时段', current: '10:00', compare: '提前1小时', status: '关注' },
      { item: '承压科室', current: '3个', compare: '+1个', status: '关注' },
      { item: '节后回补', current: '+18.4%', compare: '+6.2pp', status: '正常' },
      { item: '候诊压力', current: '+22%', compare: '+8pp', status: '关注' },
    ],
  },
];
