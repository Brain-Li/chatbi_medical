import { useState } from 'react';
import { Settings } from 'lucide-react';

interface Database {
  id: number;
  logicName: string;
  type: string;
  creator: string;
  description: string;
  updateTime: string;
}

export default function DatabaseManagement() {
  const [databases] = useState<Database[]>([]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      {/* 顶部操作栏 */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-end gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
            创建数据库连接
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
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">逻辑名称</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">类型</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">创建人</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">更新时间</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {databases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-32 text-center text-gray-400 text-sm">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  databases.map((db) => (
                    <tr key={db.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700">{db.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{db.logicName}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{db.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{db.creator}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{db.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{db.updateTime}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button className="text-blue-600 hover:text-blue-700 text-sm">
                            编辑
                          </button>
                          <button className="text-blue-600 hover:text-blue-700 text-sm">
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
