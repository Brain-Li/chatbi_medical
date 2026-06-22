import { Link, useLocation } from 'react-router';

const tabs = [
  { name: '问答', path: '/' },
  { name: '报告', path: '/report' },
  { name: '配置中心', path: '/settings' },
];

export default function TopNavigation() {
  const location = useLocation();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-semibold text-blue-600">
            智能问数
          </Link>

          <nav className="flex items-center gap-6">
            {tabs.map((tab) => {
              const active =
                tab.path === '/'
                  ? location.pathname === '/'
                  : location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`);

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`relative px-1 py-4 text-sm transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.name}
                  {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <span className="text-xs text-blue-600">A</span>
          </div>
          <span className="text-sm text-blue-600">admin</span>
        </div>
      </div>
    </header>
  );
}
