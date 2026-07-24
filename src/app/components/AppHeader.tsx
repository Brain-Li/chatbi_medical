import { LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { clearDemoAuthSession, getDemoAuthUsername } from '../utils/demoAuth';
import { BrandLogo } from './BrandLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  const username = getDemoAuthUsername();

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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e5e6eb] bg-white/80 text-[#4e5969] shadow-[0_1px_2px_rgba(29,33,41,0.06)] transition-colors hover:text-[#165dff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"
            aria-label="打开账号菜单"
          >
            <UserRound className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
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
          className="w-[196px] rounded-[8px] border-[#ebedf0] bg-white p-1.5 text-[#1d2129] shadow-[0_6px_18px_rgba(29,33,41,0.07)]"
        >
          <DropdownMenuLabel className="flex h-10 min-w-0 items-center gap-2 px-2.5 py-0 text-[14px] font-medium leading-[22px] text-[#1d2129]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f3ff] text-[#165dff]">
              <UserRound className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate">{username}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 my-1 bg-[#f5f6f7]" />
          <DropdownMenuItem
            onSelect={handleLogout}
            className="group h-9 cursor-pointer rounded-md px-2.5 text-[14px] font-normal text-[#f53f3f] hover:bg-[#f2f3f5] hover:text-[#f53f3f] focus:bg-[#f2f3f5] focus:text-[#f53f3f]"
          >
            <LogOut
              className="h-4 w-4 text-[#f53f3f]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
