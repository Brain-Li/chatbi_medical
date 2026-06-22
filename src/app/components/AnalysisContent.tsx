import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react';

interface AnalysisContentProps {
  status: 'analyzing' | 'completed';
  hasResultData?: boolean; // 是否有结果数据
  intentStep?: 'pending' | 'processing' | 'completed'; // 意图解析步骤状态
  sqlStep?: 'pending' | 'processing' | 'completed'; // SQL生成步骤状态
  visibleTables?: string[]; // 流式输出：已显示的数据源
  visibleMetrics?: string[]; // 流式输出：已显示的指标
  showQueryMode?: boolean; // 流式输出：是否显示查询模式
  visibleSqlButtons?: number; // 流式输出：已显示的SQL按钮数量（0-3）
  isInterrupted?: boolean; // 是否被中断
}

export default function AnalysisContent({ status, hasResultData, intentStep, sqlStep, visibleTables, visibleMetrics, showQueryMode, visibleSqlButtons, isInterrupted }: AnalysisContentProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedSqlType, setSelectedSqlType] = useState<'rule' | 'corrected' | 'final' | null>(null);

  // 移除自动收起逻辑 - 保持展开状态
  // useEffect(() => {
  //   if (hasResultData) {
  //     setIsExpanded(false);
  //   }
  // }, [hasResultData]);

  const tables = [
    { name: '门诊费用' },
    { name: '门诊药品费用' },
    { name: '门诊材料费用' },
    { name: '门诊检查费用' },
    { name: '门诊治疗费用' },
    { name: '门诊西药费用' },
    { name: '门诊检验费用' },
    { name: '门诊检查费用' },
  ];

  const metrics = [
    '门诊基本药物总金额',
    '门诊药品费用',
    '门诊材料费',
    '门诊检查费用',
    '门诊治疗费用'
  ];

  // 判断是否应该使用流式数据
  const shouldUseStreamingData = intentStep === 'processing' || intentStep === 'completed';
  
  // 决定显示哪些数据
  const displayTables = shouldUseStreamingData && visibleTables ? visibleTables : (intentStep === 'completed' ? tables.map(t => t.name) : []);
  const displayMetrics = shouldUseStreamingData && visibleMetrics ? visibleMetrics : (intentStep === 'completed' ? metrics : []);

  // SQL语句数据
  const sqlData = {
    rule: `SELECT 
  community_name AS 社区名称,
  SUM(prescription_amount) AS 门诊处方费用总额,
  COUNT(DISTINCT patient_id) AS 患者人数
FROM outpatient_fees
WHERE fee_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
  AND fee_date < DATE_FORMAT(CURDATE(), '%Y-%m-01')
GROUP BY community_name
ORDER BY 门诊处方费用总额 DESC;`,
    corrected: `SELECT 
  t1.community_name AS 社区名称,
  SUM(t1.prescription_amount) AS 门诊处方费用总额,
  COUNT(DISTINCT t1.patient_id) AS 患者人数,
  AVG(t1.prescription_amount) AS 人均处方费用
FROM outpatient_fees t1
WHERE t1.fee_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
  AND t1.fee_date < DATE_FORMAT(CURDATE(), '%Y-%m-01')
GROUP BY t1.community_name
ORDER BY 门诊处方费用总额 DESC;`,
    final: `SELECT 
  t1.community_name AS 社区名称,
  SUM(t1.prescription_amount) AS 门诊处方费用总额,
  COUNT(DISTINCT t1.patient_id) AS 患者人数,
  ROUND(AVG(t1.prescription_amount), 2) AS 人均处方费用
FROM outpatient_fees t1
INNER JOIN community_info t2 ON t1.community_id = t2.community_id
WHERE t1.fee_date >= '2026-02-01'
  AND t1.fee_date < '2026-03-01'
  AND t1.is_deleted = 0
GROUP BY t1.community_name, t1.community_id
ORDER BY 门诊处方费用总额 DESC
LIMIT 100;`
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-900">
            {status === 'analyzing' ? (isInterrupted ? '分析中断' : '分析中') : '分析完毕'}
          </span>
          {status === 'analyzing' && !isInterrupted ? (
            // 分析中：右边显示3个闪烁的蓝色圆点
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '200ms' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '400ms' }}></div>
            </div>
          ) : status === 'analyzing' && isInterrupted ? (
            // 分析中断：显示警告图标
            <span className="text-sm text-amber-600">⚠️</span>
          ) : (
            // 分析完毕：显示耗时
            <span className="text-sm text-gray-400">（用时8.5s）</span>
          )}
        </div>
        {status === 'completed' && (
          isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )
        )}
      </button>

      {/* Content */}
      {isExpanded && intentStep !== 'pending' && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="relative mt-4">
            {/* 意图解析部分 */}
            <div className="relative flex gap-3 pb-6">
              {/* 左侧图标和连接线 */}
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  intentStep === 'pending' ? 'bg-gray-200' : intentStep === 'processing' ? 'bg-blue-500' : 'bg-green-500'
                }`}>
                  {intentStep === 'pending' ? (
                    <Loader2 className="w-2.5 h-2.5 text-gray-500 animate-spin" />
                  ) : intentStep === 'processing' ? (
                    <Loader2 className={`w-2.5 h-2.5 text-white ${isInterrupted ? '' : 'animate-spin'}`} />
                  ) : (
                    <Check className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
                <div className="w-0.5 bg-gray-200 flex-1 mt-1"></div>
              </div>
              
              {/* 右侧内容 */}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 mb-2">意图解析</div>
                <div className="space-y-2 text-xs">
                  {/* 数据源 - 只在有数据时显示 */}
                  {displayTables.length > 0 && (
                    <div className="text-gray-600 flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">数据源：</span>
                      {displayTables.map((table, index) => (
                        <span 
                          key={index} 
                          className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
                        >
                          {table}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 查询模式 - 只在showQueryMode为true时显示 */}
                  {showQueryMode && (
                    <div className="text-gray-600">
                      <span className="font-medium">查询模式：</span>
                      <span className="ml-2">联表查询</span>
                    </div>
                  )}
                  
                  {/* 指标 - 只在有数据时显示 */}
                  {displayMetrics.length > 0 && (
                    <div className="text-gray-600 flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">指标：</span>
                      {displayMetrics.map((metric, index) => (
                        <span 
                          key={index} 
                          className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
                        >
                          {metric}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SQL生成部分 - 只在sqlStep不是pending时显示 */}
            {sqlStep !== 'pending' && (
              <div className="relative flex gap-3">
                {/* 左侧图标 */}
                <div className="flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    sqlStep === 'processing' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {sqlStep === 'processing' ? (
                      <Loader2 className={`w-2.5 h-2.5 text-white ${isInterrupted ? '' : 'animate-spin'}`} />
                    ) : (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                </div>
                
                {/* 右侧内容 */}
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 mb-2">SQL生成</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleSqlButtons > 0 && (
                      <button
                        onClick={() => setSelectedSqlType(selectedSqlType === 'rule' ? null : 'rule')}
                        className={`px-2.5 py-1 rounded text-xs border transition-all ${
                          selectedSqlType === 'rule'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        Rule解析toS2SQL
                      </button>
                    )}
                    {visibleSqlButtons > 1 && (
                      <span className="text-gray-300">|</span>
                    )}
                    {visibleSqlButtons > 1 && (
                      <button
                        onClick={() => setSelectedSqlType(selectedSqlType === 'corrected' ? null : 'corrected')}
                        className={`px-2.5 py-1 rounded text-xs border transition-all ${
                          selectedSqlType === 'corrected'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        修正S2SQL
                      </button>
                    )}
                    {visibleSqlButtons > 2 && (
                      <span className="text-gray-300">|</span>
                    )}
                    {visibleSqlButtons > 2 && (
                      <button
                        onClick={() => setSelectedSqlType(selectedSqlType === 'final' ? null : 'final')}
                        className={`px-2.5 py-1 rounded text-xs border transition-all ${
                          selectedSqlType === 'final'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        最终执行SQL
                      </button>
                    )}
                  </div>

                  {/* SQL展示区域 */}
                  {selectedSqlType && (
                    <div className="mt-3 bg-gray-50 rounded border border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">
                          {selectedSqlType === 'rule' && 'Rule解析toS2SQL'}
                          {selectedSqlType === 'corrected' && '修正S2SQL'}
                          {selectedSqlType === 'final' && '最终执行SQL'}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(sqlData[selectedSqlType]);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                        >
                          复制
                        </button>
                      </div>
                      <pre className="text-xs text-gray-800 font-mono whitespace-pre overflow-x-auto">
                        {sqlData[selectedSqlType]}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}