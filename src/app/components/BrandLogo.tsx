import brandLogoMark from '../../assets/figma-home/brand-logo-mark.svg';

export function BrandLogo() {
  return (
    <span className="flex shrink-0 items-center gap-3">
      <img className="h-10 w-10" src={brandLogoMark} alt="" />
      <span className="whitespace-nowrap font-['Login_Figma_Sans','PingFang_SC','Noto_Sans_SC',sans-serif] text-[22px] font-medium leading-8 text-[#1d2129]">
        智能问数
      </span>
    </span>
  );
}
