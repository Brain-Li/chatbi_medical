import { Link } from 'react-router';
import logoImage from '../../assets/figma-home/logo.png';
import menuFoldIcon from '../../assets/figma-home/menu-fold-3-line.svg';
import menuUnfoldIcon from '../../assets/figma-home/menu-unfold-3-line.svg';

type AppHeaderProps = {
  menuOpen?: boolean;
  onMenuClick?: () => void;
  onLoginClick?: () => void;
};

export function AppHeader({ menuOpen = false, onMenuClick, onLoginClick }: AppHeaderProps) {
  const menuIcon = menuOpen ? menuFoldIcon : menuUnfoldIcon;
  const loginClassName =
    'h-8 rounded-xl border border-[#1677ff] bg-[#1a1c26] px-4 text-[14px] font-normal leading-6 tracking-[0.15px] text-white';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <Link to="/home" className="flex shrink-0 items-center">
          <img className="h-10 w-10 rounded-[10px] object-cover" src={logoImage} alt="" />
        </Link>
        <Link
          to="/home"
          className="font-['Source_Han_Serif_CN','Noto_Sans_SC',serif] text-[20px] font-bold leading-7 text-black"
        >
          智能问数
        </Link>
        <button
          type="button"
          onClick={onMenuClick}
          className="group relative flex h-6 w-6 items-center justify-center"
          aria-label={menuOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          <img className="h-6 w-6" src={menuIcon} alt="" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <span className="h-0 w-0 border-y-[5px] border-r-[4px] border-y-transparent border-r-[#1d2129]" />
            <span className="rounded-[4px] bg-[#1d2129] px-3 py-1 text-center font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white whitespace-nowrap">
              {menuOpen ? '收起侧边栏' : '展开侧边栏'}
            </span>
          </span>
        </button>
      </div>

      {onLoginClick ? (
        <button type="button" onClick={onLoginClick} className={loginClassName}>
          登录
        </button>
      ) : (
        <Link to="/" className={loginClassName}>
          登录
        </Link>
      )}
    </header>
  );
}
