import { User } from 'lucide-react';

export default function Header() {
  const navItems = [
    { label: '问答对话', active: true },
    { label: '助理管理', active: false },
    { label: 'MCP 接入', active: false },
    { label: '语义建模', active: false },
    { label: '指标市场', active: false },
    { label: '数据库管理', active: false },
    { label: '大模型管理', active: false },
    { label: '系统设置', active: false },
  ];

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <h1 className="text-blue-600 font-semibold text-lg">智能问数</h1>
        
        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`text-sm px-1 py-2 ${
                item.active
                  ? 'text-blue-600 border-b-2 border-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
        <span className="text-sm text-gray-700">admin</span>
      </div>
    </header>
  );
}
