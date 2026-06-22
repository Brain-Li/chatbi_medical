import { useState } from 'react';
import { PencilLine, Settings, Trash2 } from 'lucide-react';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';

interface LLMModel {
  id: number;
  connectionName: string;
  modelName: string;
  version: string;
  creator: string;
  description: string;
  updateTime: string;
}

export default function LLMManagement() {
  const [models] = useState<LLMModel[]>([
    {
      id: 1,
      connectionName: 'OpenAI模型DEMO',
      modelName: 'gpt-4o-mini',
      version: 'OPEN_AI',
      creator: 'admin',
      description: 'Billingchain的技术使用的是用于数据分析的TokenLLM1000，正在使用其AI能力大模型',
      updateTime: '2026-01-07 09:40:53',
    },
    {
      id: 2,
      connectionName: 'qwen-max',
      modelName: 'qwen-max',
      version: 'OPEN_AI',
      creator: 'admin',
      description: '-',
      updateTime: '2026-02-27 13:39:55',
    },
    {
      id: 3,
      connectionName: 'qwen-plus',
      modelName: 'qwen-plus',
      version: 'OPEN_AI',
      creator: 'admin',
      description: '-',
      updateTime: '2026-02-24 07:57:31',
    },
    {
      id: 4,
      connectionName: 'deepseek-v3',
      modelName: 'deepseek-v3',
      version: 'OPEN_AI',
      creator: 'admin',
      description: '-',
      updateTime: '2026-02-24 07:57:44',
    },
    {
      id: 5,
      connectionName: 'Qwen-Turbo',
      modelName: 'qwen-turbo',
      version: 'OPEN_AI',
      creator: 'admin',
      description: '-',
      updateTime: '2026-02-24 07:57:57',
    },
    {
      id: 6,
      connectionName: 'deepseek-v3-http',
      modelName: 'deepseek-v3',
      version: 'HTTP',
      creator: 'lxyye',
      description: '-',
      updateTime: '2026-02-27 21:04:18',
    },
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      {/* 顶部操作栏 */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-end gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
            创建大模型连接
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="bg-white mx-6 my-6 rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">连接名称</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">模型名称</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">模型版本</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">创建人</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">更新时间</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700">{model.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{model.connectionName}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{model.modelName}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{model.version}</td>
                    <td className="px-6 py-4 text-sm text-blue-600">{model.creator}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate" title={model.description}>
                      {model.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{model.updateTime}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <ConfigActionIconButton icon={PencilLine} label="编辑" variant="edit" />
                        <ConfigActionIconButton icon={Trash2} label="删除" variant="delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页信息 */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-600">
              第 1-{models.length} 条/共 {models.length} 条
            </span>
            <button className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors text-sm">
              1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
