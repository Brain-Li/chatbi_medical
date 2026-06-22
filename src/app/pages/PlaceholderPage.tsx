import { useLocation } from 'react-router';

export default function PlaceholderPage() {
  const location = useLocation();
  
  const pathNames: Record<string, string> = {
    '/hospital': '医院介绍',
    '/editor': '编辑管理',
    '/semantic': '语义模型',
    '/plugins': 'MCP 能力',
    '/resources': '资源库管理',
    '/llm': '大模型管理',
    '/settings': '系统设置',
  };

  const pageName = pathNames[location.pathname] || '页面';

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">{pageName}</h2>
        <p className="text-gray-500">此页面正在开发中...</p>
      </div>
    </div>
  );
}
