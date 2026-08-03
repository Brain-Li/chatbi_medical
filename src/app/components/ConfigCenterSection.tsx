import { ReactNode } from 'react';

type PrimarySection = 'agents' | 'datasets' | 'database' | 'system';

type SecondaryTab = {
  label: string;
  section: string;
  systemTab?: string;
};

type ConfigCenterSectionProps = {
  activePrimary: PrimarySection;
  secondaryTabs: SecondaryTab[];
  activeSecondary: string;
  activeSystemTab?: string;
  onOpenPrimarySection: (section: PrimarySection) => void;
  onOpenSecondary: (tab: SecondaryTab) => void;
  children: ReactNode;
};

const primaryTabs: Array<{ label: string; section: PrimarySection }> = [
  { label: '能力配置', section: 'agents' },
  { label: '语义资产', section: 'datasets' },
  { label: '平台接入', section: 'database' },
  { label: '系统设置', section: 'system' },
];

export default function ConfigCenterSection({
  activePrimary,
  secondaryTabs,
  activeSecondary,
  activeSystemTab,
  onOpenPrimarySection,
  onOpenSecondary,
  children,
}: ConfigCenterSectionProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-['PingFang_SC','Microsoft_YaHei',sans-serif] text-[#1d2129]">
      <div className="shrink-0 px-[22px] pt-[22px]">
        <h1 className="h-10 text-xl font-semibold leading-7 tracking-[0px]">配置中心</h1>

        <nav className="mt-4 flex h-10 items-start gap-6 border-b border-[#e5e6eb]" aria-label="配置中心分类">
          {primaryTabs.map((tab) => {
            const active = tab.section === activePrimary;
            return (
              <button
                key={tab.section}
                type="button"
                onClick={() => onOpenPrimarySection(tab.section)}
                className={`relative h-10 text-base leading-6 tracking-[0px] ${
                  active ? 'font-medium text-[#1d2129]' : 'font-normal text-[#4e5969]'
                }`}
              >
                {tab.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1d2129]" />}
              </button>
            );
          })}
        </nav>

        <nav className="mt-4 flex min-h-[30px] flex-wrap items-center gap-3" aria-label="当前配置分类">
          {secondaryTabs.map((tab) => {
            const active = tab.section === activeSecondary && tab.systemTab === activeSystemTab;
            return (
              <button
                key={`${tab.section}-${tab.systemTab ?? 'default'}`}
                type="button"
                onClick={() => onOpenSecondary(tab)}
                className={`h-[30px] rounded-xl px-3 text-sm font-normal leading-[22px] tracking-[0px] transition-colors ${
                  active
                    ? 'bg-[#1d2129] text-white'
                    : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}
