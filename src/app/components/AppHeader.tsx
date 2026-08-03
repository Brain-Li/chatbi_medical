import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import userFillIcon from '../../assets/figma-header/user-5-fill.svg';
import userLineIcon from '../../assets/figma-header/user-5-line.svg';
import logoutLineIcon from '../../assets/figma-header/logout-box-r-line.svg';
import { clearDemoAuthSession } from '../utils/demoAuth';
import { BrandLogo } from './BrandLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

type AppHeaderProps = {
  onLogoutClick?: () => void;
};

export function AppHeader({ onLogoutClick }: AppHeaderProps) {
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountMenuOpenedByHover = useRef(false);
  const cancelAccountMenuClose = () => {
    if (accountMenuCloseTimer.current) {
      clearTimeout(accountMenuCloseTimer.current);
      accountMenuCloseTimer.current = null;
    }
  };

  const openAccountMenuOnHover = () => {
    cancelAccountMenuClose();
    accountMenuOpenedByHover.current = true;
    setAccountMenuOpen(true);
  };

  const scheduleAccountMenuClose = () => {
    cancelAccountMenuClose();
    accountMenuCloseTimer.current = setTimeout(() => {
      setAccountMenuOpen(false);
      accountMenuCloseTimer.current = null;
    }, 180);
  };

  useEffect(() => cancelAccountMenuClose, []);

  const handleLogout = () => {
    clearDemoAuthSession();
    onLogoutClick?.();
    navigate('/', { replace: true });
  };

  return (
    <header className="flex h-[54px] shrink-0 items-center justify-between pl-[10px] pr-4">
      <Link to="/home" className="flex shrink-0 items-center">
        <BrandLogo />
      </Link>

      <DropdownMenu
        modal={false}
        open={accountMenuOpen}
        onOpenChange={(open) => {
          cancelAccountMenuClose();
          setAccountMenuOpen(open);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseEnter={openAccountMenuOnHover}
            onMouseLeave={scheduleAccountMenuClose}
            onPointerDown={() => {
              accountMenuOpenedByHover.current = false;
            }}
            onKeyDown={() => {
              accountMenuOpenedByHover.current = false;
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f7f8fa] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 data-[state=open]:bg-[#f2f3f5]"
            aria-label="打开账号菜单"
          >
            <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full" aria-hidden="true">
              <img src={userFillIcon} alt="" className="h-5 w-4" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          onMouseEnter={cancelAccountMenuClose}
          onMouseLeave={scheduleAccountMenuClose}
          onOpenAutoFocus={(event) => {
            if (accountMenuOpenedByHover.current) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            if (accountMenuOpenedByHover.current) event.preventDefault();
            accountMenuOpenedByHover.current = false;
          }}
          className="w-[119px] min-w-[119px] rounded-[8px] border-[1.5px] border-[#edeff1] bg-white p-0 text-[#1d2129] shadow-[0_14px_14.1px_rgba(0,0,0,0.11)]"
        >
          <DropdownMenuLabel className="flex h-[39px] min-w-0 items-center gap-1 border-b border-[#f2f3f5] px-3 py-0 text-[14px] font-normal leading-[22px] text-[#1d2129]">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              <img src={userLineIcon} alt="" className="h-[13.3333px] w-[10.6667px]" />
            </span>
            <span className="whitespace-nowrap">平台管理员</span>
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={handleLogout}
            className="h-[38px] cursor-pointer gap-1 rounded-none px-3 py-0 text-[14px] font-normal leading-[22px] text-[#1d2129] hover:bg-[#f7f8fa] hover:text-[#1d2129] focus:bg-[#f7f8fa] focus:text-[#1d2129]"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              <img src={logoutLineIcon} alt="" className="h-[13.3333px] w-[12.6667px]" />
            </span>
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
