import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Assistant } from '../types';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AssistantManagement() {
  const navigate = useNavigate();
  const [assistants, setAssistants] = useState<Assistant[]>([
    {
      id: '1',
      name: '问数助手',
      description: '只提今天提问过的',
      isActive: false,
      creator: 'admin',
      updatedAt: new Date('2025-03-05 14:17:13'),
    },
    {
      id: '2',
      name: '汽车舆情',
      description: '',
      isActive: true,
      creator: 'admin',
      updatedAt: new Date('2025-03-05 14:34:34'),
    },
    {
      id: '3',
      name: '门诊收费数据',
      description: '门诊收费数据分析',
      isActive: true,
      creator: 'admin',
      updatedAt: new Date('2025-01-25 21:10:39'),
    },
    {
      id: '4',
      name: '医疗数据',
      description: '',
      isActive: true,
      creator: 'liyue',
      updatedAt: new Date('2025-02-03 16:37:35'),
    },
    {
      id: '5',
      name: '706测试',
      description: '',
      isActive: true,
      creator: 'admin',
      updatedAt: new Date('2025-03-05 16:42:04'),
    },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleAssistantStatus = (id: string) => {
    setAssistants(prev => prev.map(assistant => 
      assistant.id === id ? { ...assistant, isActive: !assistant.isActive } : assistant
    ));
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* 新建按钮 */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => navigate('/assistant-editor')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            新建助理
          </button>
        </div>

        {/* 表格 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">助理名称</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">更新人</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">更新时间</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assistants.map((assistant) => (
                <tr key={assistant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <button className="text-blue-600 hover:text-blue-700 text-sm">
                      {assistant.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {assistant.description || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-600">
                        {assistant.isActive ? '已启用' : '已禁用'}
                      </span>
                      <button
                        onClick={() => toggleAssistantStatus(assistant.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          assistant.isActive ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            assistant.isActive ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {assistant.creator}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {formatDate(assistant.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button className="text-blue-600 hover:text-blue-700 text-sm">
                        编辑
                      </button>
                      <button className="text-blue-600 hover:text-blue-700 text-sm">
                        复制
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center text-sm rounded bg-blue-600 text-white">
                {currentPage}
              </button>
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-1 rounded hover:bg-gray-100"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}