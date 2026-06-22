import { useState, useRef, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ThumbsUp, ThumbsDown, Download, FileDown, ImageIcon, RefreshCw, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, ChevronDown, ScatterChart, Activity, List, MapPin, TrendingDown, BarChart2, Calendar } from 'lucide-react';
import { toPng } from 'html-to-image';

interface RichMessageContentProps {
  content: string;
  isRich?: boolean;
  onQuestionClick?: (question: string) => void;
  onRegenerate?: (messageId: string) => void;
  messageId?: string;
  isInterrupted?: boolean;
}

export default function RichMessageContent({ content, isRich = false, onQuestionClick, onRegenerate, messageId, isInterrupted }: RichMessageContentProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chartTypeMenuRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'scatter' | 'gauge' | 'ranking' | 'map' | 'funnel' | 'progress'>('bar');
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null); // 点赞/踩状态
  const [selectedDepartment, setSelectedDepartment] = useState('全部科室'); // 科室筛选
  
  // 生成唯一的图表ID，用于React keys (使用useMemo确保稳定性)
  const chartId = useMemo(() => messageId || `chart-${Math.random().toString(36).substr(2, 9)}`, [messageId]);

  // 日期范围选择
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [dateRangeLabel, setDateRangeLabel] = useState('2024年全年');
  
  // 科室选项
  const departmentOptions = ['全部科室', '内科', '外科', '儿科', '眼科', '耳鼻喉科', '口腔科', '皮肤科', '妇产科'];
  
  // 快捷日期选项
  const quickDateOptions = [
    { label: '今天', days: 0 },
    { label: '近7天', days: 7 },
    { label: '近30天', days: 30 },
    { label: '近3个月', days: 90 },
    { label: '近6个月', days: 180 },
    { label: '近1年', days: 365 },
  ];
  
  // 计算快捷日期
  const getQuickDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };
  
  // 处理快捷日期选择
  const handleQuickDateSelect = (days: number, label: string) => {
    const { start, end } = getQuickDateRange(days);
    setStartDate(start);
    setEndDate(end);
    setDateRangeLabel(label);
    setShowDatePicker(false);
  };
  
  // 格式化日期显示
  const formatDateDisplay = () => {
    if (dateRangeLabel !== '自定义') {
      return dateRangeLabel;
    }
    return `${startDate} 至 ${endDate}`;
  };
  
  // 图表类型配置
  const chartTypes = [
    { value: 'bar', label: '柱图', icon: BarChart3 },
    { value: 'pie', label: '饼图', icon: PieChartIcon },
    { value: 'line', label: '线图', icon: LineChartIcon },
    { value: 'scatter', label: '散点图', icon: ScatterChart },
    { value: 'gauge', label: '指标看板', icon: Activity },
    { value: 'ranking', label: '排行榜', icon: List },
    { value: 'map', label: '色彩地图', icon: MapPin },
    { value: 'funnel', label: '漏斗图', icon: TrendingDown },
    { value: 'progress', label: '进度条', icon: BarChart2 },
  ] as const;

  const currentChartType = chartTypes.find(t => t.value === chartType)!;
  
  // 如果不是富文本消息，直接显示内容
  if (!isRich) {
    return <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  // 模拟数据 - 根据图片内容
  const chartData = [
    { id: 'clinic-fee', name: '门诊费用', value: 183.69 },
    { id: 'clinic-material', name: '门诊材料费用', value: 5.02 },
    { id: 'clinic-check', name: '门诊检查费用', value: 52.33 },
    { id: 'clinic-treatment', name: '门诊治疗费用', value: 26.68 },
    { id: 'clinic-medicine', name: '门诊药品费用', value: 61.76 },
    { id: 'clinic-western', name: '门诊西药费用', value: 61.4 },
    { id: 'clinic-basic', name: '门诊基本药物费用', value: 21.48 },
  ];

  // 饼图颜色
  const COLORS = ['#4F8EF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  const recommendations = [
    '去年第三季度907医院门诊费用是多少？',
    '上个月门诊药品费用和检查费用的对比？',
    '今年上半年各科室门诊人数排名？',
  ];

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (chartTypeMenuRef.current && !chartTypeMenuRef.current.contains(event.target as Node)) {
        setShowChartTypeMenu(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    if (showExportMenu || showChartTypeMenu || showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu, showChartTypeMenu, showDatePicker]);

  // 导出图片
  const handleExportImage = async () => {
    if (chartRef.current) {
      try {
        const dataUrl = await toPng(chartRef.current, {
          backgroundColor: '#ffffff',
          pixelRatio: 2, // 高清图片
        });
        const link = document.createElement('a');
        link.download = `门诊收费数据_${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
        setShowExportMenu(false);
      } catch (error) {
        console.error('导出图片失败:', error);
      }
    }
  };

  // 导出CSV数据
  const handleExportData = () => {
    // 生成CSV内容
    const headers = ['项目', '金额（亿）'];
    const rows = chartData.map(item => [item.name, item.value]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // 创建Blob并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `门诊收费数据_${new Date().getTime()}.csv`;
    link.click();
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-4">
      {/* 数据查询部分 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* 图表头部 - 标题和导按钮 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="text-sm font-medium text-gray-900">
            去年假期门诊收费总额
          </div>
          
          <div className="flex items-center gap-2">
            {/* 图表类型切换按钮 */}
            <div className="relative" ref={chartTypeMenuRef}>
              <button
                onClick={() => setShowChartTypeMenu(!showChartTypeMenu)}
                className="w-9 h-9 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-all"
              >
                <currentChartType.icon className="w-4 h-4 text-gray-600" />
              </button>

              {/* 图表类型网格弹窗 */}
              {showChartTypeMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-10 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {chartTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setChartType(type.value);
                          setShowChartTypeMenu(false);
                        }}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg transition-all ${
                          chartType === type.value
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-blue-50 hover:border-blue-200'
                        }`}
                      >
                        <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${
                          chartType === type.value ? 'bg-blue-100' : 'bg-white'
                        }`}>
                          <type.icon className={`w-5 h-5 ${
                            chartType === type.value ? 'text-blue-600' : 'text-gray-400'
                          }`} />
                        </div>
                        <span className={`text-xs ${
                          chartType === type.value ? 'text-blue-600 font-medium' : 'text-gray-600'
                        }`}>
                          {type.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          
            {/* 导出按钮组 */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* 导出下拉菜单 */}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  <button
                    onClick={handleExportImage}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>导出图片</span>
                  </button>
                  <div className="border-t border-gray-100"></div>
                  <button
                    onClick={handleExportData}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>导出数据</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 筛选器区域 */}
        <div className="px-4 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            {/* 日期范围筛选 */}
            <div className="relative" ref={datePickerRef}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDateDisplay()}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* 日期范围选择弹窗 */}
              {showDatePicker && (
                <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-10 overflow-hidden">
                  {/* 快捷选项 */}
                  <div className="border-b border-gray-200 p-2">
                    <div className="text-xs text-gray-500 font-medium px-2 py-1">快捷选择</div>
                    <div className="grid grid-cols-3 gap-1">
                      {quickDateOptions.map(option => (
                        <button
                          key={option.label}
                          onClick={() => handleQuickDateSelect(option.days, option.label)}
                          className="px-3 py-1.5 text-xs text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 自定义日期选择 */}
                  <div className="p-3 space-y-3">
                    <div className="text-xs text-gray-500 font-medium">自定义日期范围</div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">开始日期</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">结束日期</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setDateRangeLabel('自定义');
                          setShowDatePicker(false);
                        }}
                        className="w-full px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                      >
                        应用自定义日期
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 科室筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">科室：</span>
              <select 
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
              >
                {departmentOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* 当前筛选条件提示 */}
            {(dateRangeLabel !== '2024年全年' || selectedDepartment !== '全部科室') && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  已筛选：{dateRangeLabel} · {selectedDepartment}
                </span>
                <button
                  onClick={() => {
                    setStartDate('2024-01-01');
                    setEndDate('2024-12-31');
                    setDateRangeLabel('2024年全年');
                    setSelectedDepartment('全部科室');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  重置
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 柱状图 */}
        <div className="p-4">
          <div className="w-full h-64" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' && (
                <BarChart key={`bar-chart-${chartId}`} data={chartData}>
                  <CartesianGrid key={`grid-${chartId}`} strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    key={`xaxis-${chartId}`}
                    dataKey="name" 
                    angle={-30} 
                    textAnchor="end" 
                    height={80}
                    tick={{ fontSize: 12, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    key={`yaxis-${chartId}`}
                    tick={{ fontSize: 12, fill: '#666' }}
                    label={{ value: '亿', angle: 0, position: 'top', offset: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    key={`tooltip-${chartId}`}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => `${value}亿`}
                  />
                  <Bar 
                    key={`bar-${chartId}`}
                    dataKey="value" 
                    fill="#4F8EF7" 
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fontSize: 11, fill: '#666' }}
                  />
                </BarChart>
              )}
              {chartType === 'line' && (
                <LineChart key={`line-chart-${chartId}`} data={chartData}>
                  <CartesianGrid key={`grid-${chartId}`} strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    key={`xaxis-${chartId}`}
                    dataKey="name" 
                    angle={-30} 
                    textAnchor="end" 
                    height={80}
                    tick={{ fontSize: 12, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    key={`yaxis-${chartId}`}
                    tick={{ fontSize: 12, fill: '#666' }}
                    label={{ value: '亿', angle: 0, position: 'top', offset: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    key={`tooltip-${chartId}`}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => `${value}亿`}
                  />
                  <Line 
                    key={`line-${chartId}`}
                    dataKey="value" 
                    stroke="#4F8EF7" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
              {chartType === 'pie' && (
                <PieChart key={`pie-chart-${chartId}`}>
                  <Pie 
                    key={`pie-${chartId}`}
                    data={chartData} 
                    cx="50%" 
                    cy="50%" 
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}亿`}
                    outerRadius={80}
                    fill="#4F8EF7"
                    dataKey="value"
                  >
                    {chartData.map((entry) => (
                      <Cell key={`cell-${chartId}-${entry.id}`} fill={COLORS[chartData.indexOf(entry) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    key={`tooltip-${chartId}`}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => `${value}亿`}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 操作按钮区域：点赞/踩 和 重新生成 */}
      <div className="flex items-center gap-2">
        {/* 点赞按钮 */}
        <button
          onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-all ${
            feedback === 'like'
              ? 'bg-blue-50 text-blue-600 border border-blue-200'
              : 'text-gray-600 bg-transparent hover:bg-gray-100'
          }`}
        >
          <ThumbsUp className={`w-4 h-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
        </button>

        {/* 踩按钮 */}
        <button
          onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-all ${
            feedback === 'dislike'
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'text-gray-600 bg-transparent hover:bg-gray-100'
          }`}
        >
          <ThumbsDown className={`w-4 h-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
        </button>

        {/* 重新生成按钮 */}
        {onRegenerate && messageId && (
          <button
            onClick={() => onRegenerate(messageId)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 bg-transparent hover:bg-gray-100 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>重新生成</span>
          </button>
        )}
      </div>

      {/* 推荐相似问题 - 独立区域 */}
      <div className="space-y-2">
        {recommendations.map((rec, index) => (
          <div key={index}>
            <button
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded-full text-xs text-gray-700 hover:bg-gray-50 transition-all"
              onClick={() => onQuestionClick && onQuestionClick(rec)}
            >
              <span>{rec}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}