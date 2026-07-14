import { Link, useLocation } from 'react-router';

const tabs = [
  { name: '首页', path: '/' },
  { name: '模板库', path: '/templates' },
  { name: '订阅管理', path: '/report-subscriptions' },
  { name: '配置中心', path: '/settings' },
];

export default function TopNavigation() {
  const location = useLocation();
  const homeActive =
    location.pathname === '/' ||
    location.pathname === '/ask' ||
    location.pathname.startsWith('/ask/') ||
    location.pathname === '/report' ||
    location.pathname.startsWith('/report/');

  return (
    <header className="relative z-20 border-b border-white/70 bg-[linear-gradient(180deg,rgba(246,250,255,0.96)_0%,rgba(247,251,255,0.88)_100%)] shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:px-6">
        <div className="flex min-w-0 items-center">
          <Link to="/" className="group flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-[0_8px_18px_rgba(37,99,235,0.22)] ring-1 ring-white/70">
              <svg
                viewBox="0 0 36 36"
                aria-hidden="true"
                className="h-7 w-7 text-white"
              >
                <path
                  d="M8.5 10.8c0-2.1 1.7-3.8 3.8-3.8h11.4c2.1 0 3.8 1.7 3.8 3.8v7.7c0 2.1-1.7 3.8-3.8 3.8h-5.9l-5.1 4.4c-.7.6-1.7.1-1.7-.8v-3.7c-1.5-.5-2.5-1.9-2.5-3.6v-7.8Z"
                  fill="currentColor"
                  opacity="0.96"
                />
                <path
                  d="M14 18.4v-4.6M18 18.4v-7.2M22 18.4v-9"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M26.4 8.1l.6-1.8.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6ZM26.3 24.5l.8-2.2.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="text-2xl font-semibold tracking-tight text-gray-950 transition-colors group-hover:text-blue-700">
              智能问数
            </span>
          </Link>
        </div>

        <nav className="hidden min-w-0 items-center justify-center gap-9 md:flex">
          {tabs.map((tab) => {
            const active =
              tab.path === '/'
                ? homeActive
                : location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`);

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`relative flex h-16 items-center px-1 text-base font-medium transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-600 hover:text-gray-950'
                }`}
              >
                {tab.name}
                {active && (
                  <span className="absolute bottom-2.5 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-blue-600" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 ring-2 ring-white/90"
            title="admin"
          >
            <span className="text-sm font-semibold text-blue-700">A</span>
          </button>
        </div>
      </div>
    </header>
  );
}
