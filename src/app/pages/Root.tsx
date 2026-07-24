import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { AppShellBackground } from '../components/AppShellBackground';
import { PrimaryIconNav } from '../components/PrimaryIconNav';

export default function Root() {
  const location = useLocation();
  const requestedSidebarOpen = (location.state as { sidebarOpen?: boolean } | null)?.sidebarOpen;
  const isHome = location.pathname === '/home';
  const isLogin = location.pathname === '/';
  const isReportWorkspace = location.pathname === '/report';
  const isWorkspacePage = location.pathname === '/ask' || location.pathname === '/report';
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof requestedSidebarOpen === 'boolean'
      ? requestedSidebarOpen
      : !isReportWorkspace,
  );

  useEffect(() => {
    if (typeof requestedSidebarOpen === 'boolean') {
      setSidebarOpen(requestedSidebarOpen);
      return;
    }

    if (isReportWorkspace) {
      setSidebarOpen(false);
    }
  }, [isReportWorkspace, requestedSidebarOpen, location.key]);

  useEffect(() => {
    if (!isHome) {
      window.scrollTo(0, 0);
    }
  }, [isHome, location.pathname]);

  if (isHome || isLogin) {
    return <Outlet />;
  }

  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden bg-white">
        <AppShellBackground />
      </div>
      <div className="fixed inset-x-0 top-0 z-50">
        <AppHeader />
      </div>
      <div className="fixed inset-0 z-10 flex min-h-0 pt-[54px]">
        <PrimaryIconNav />
        <main className={`min-h-0 min-w-0 flex-1 overflow-hidden rounded-tl-[20px] rounded-tr-[20px] ${isWorkspacePage ? 'bg-transparent pb-0' : 'bg-white pb-[34px]'}`}>
          <Outlet
            context={{
              sidebarOpen,
              openSidebar: () => setSidebarOpen(true),
              closeSidebar: () => setSidebarOpen(false),
            }}
          />
        </main>
      </div>
    </>
  );
}
