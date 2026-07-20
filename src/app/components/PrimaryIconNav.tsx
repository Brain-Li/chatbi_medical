import { Link, useLocation } from 'react-router';

import functionFill from '../../assets/figma-home/function-fill.svg';
import functionLine from '../../assets/figma-home/function-line.svg';
import homeSmile2FillActive from '../../assets/figma-home/home-smile-2-fill-active.svg';
import homeSmile2Line from '../../assets/figma-home/home-smile-2-line.svg';
import settingsFill from '../../assets/figma-home/settings-fill.svg';
import settingsLine from '../../assets/figma-home/settings-line.svg';

type NavItem = {
  label: string;
  path: string;
  icon: string;
  activeIcon?: string;
  isActive: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    label: '首页',
    path: '/home',
    icon: homeSmile2Line,
    activeIcon: homeSmile2FillActive,
    isActive: (pathname) =>
      pathname === '/' ||
      pathname === '/home' ||
      pathname === '/ask' ||
      pathname.startsWith('/ask/') ||
      pathname === '/report' ||
      pathname.startsWith('/report/'),
  },
  {
    label: '模板库',
    path: '/templates',
    icon: functionLine,
    activeIcon: functionFill,
    isActive: (pathname) => pathname === '/templates' || pathname.startsWith('/templates/'),
  },
  {
    label: '配置中心',
    path: '/settings',
    icon: settingsLine,
    activeIcon: settingsFill,
    isActive: (pathname) => pathname === '/settings' || pathname.startsWith('/settings/'),
  },
];

export function PrimaryIconNav() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden h-full w-[60px] shrink-0 flex-col items-center gap-4 px-[10px] py-4 sm:flex" aria-label="主导航">
      {navItems.map((item) => {
        const active = item.isActive(pathname);

        return (
          <Link
            key={item.path}
            to={item.path}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex h-10 w-10 max-w-[104px] items-center justify-center rounded-lg p-2 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]/20 ${
              active ? 'bg-white' : ''
            }`}
          >
            <img aria-hidden="true" className="h-6 w-6" src={active ? item.activeIcon ?? item.icon : item.icon} alt="" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <span className="h-0 w-0 border-y-[5px] border-r-[4px] border-y-transparent border-r-[#1d2129]" />
              <span className="min-w-[57px] rounded-[4px] bg-[#1d2129] px-3 py-1 text-center font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white whitespace-nowrap">
                {item.label}
              </span>
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
