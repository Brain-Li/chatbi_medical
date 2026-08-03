import { ReactNode } from 'react';

type SemanticAssetManagementSectionProps = {
  activeSection: 'datasets' | 'dimensions' | 'indicators' | 'synonyms';
  onOpenSection: (section: SemanticAssetManagementSectionProps['activeSection']) => void;
  onOpenPrimarySection: (section: 'agents' | 'datasets' | 'database' | 'system') => void;
  children: ReactNode;
};

const primaryTabs = [
  { label: '能力配置', section: 'agents' as const },
  { label: '语义资产', section: 'datasets' as const },
  { label: '平台接入', section: 'database' as const },
  { label: '系统设置', section: 'system' as const },
];

const secondaryTabs: Array<{
  label: string;
  section: SemanticAssetManagementSectionProps['activeSection'];
}> = [
  { label: '数据集', section: 'datasets' },
  { label: '维度定义', section: 'dimensions' },
  { label: '指标市场', section: 'indicators' },
  { label: '同义词治理', section: 'synonyms' },
];

export default function SemanticAssetManagementSection({
  activeSection,
  onOpenSection,
  onOpenPrimarySection,
  children,
}: SemanticAssetManagementSectionProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-[#1d2129]">
      <div className="shrink-0 px-[22px] pt-[22px]">
        <div className="flex h-10 items-start justify-between">
          <h1 className="font-['PingFang_SC','Microsoft_YaHei',sans-serif] text-xl font-semibold leading-7 tracking-[0px]">
            配置中心
          </h1>
        </div>

        <nav className="mt-4 flex h-10 items-start gap-6 border-b border-[#e5e6eb]" aria-label="配置中心分类">
          {primaryTabs.map((tab) => {
            const active = tab.section === 'datasets';
            return (
              <button
                key={tab.section}
                type="button"
                onClick={() => onOpenPrimarySection(tab.section)}
                className={`relative h-10 font-['PingFang_SC','Microsoft_YaHei',sans-serif] text-base leading-6 tracking-[0px] ${
                  active ? 'font-medium text-[#1d2129]' : 'font-normal text-[#4e5969]'
                }`}
              >
                {tab.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1d2129]" />}
              </button>
            );
          })}
        </nav>

        <nav className="mt-4 flex h-[30px] flex-wrap items-center gap-3" aria-label="语义资产分类">
          {secondaryTabs.map((tab) => {
            const active = activeSection === tab.section;
            return (
              <button
                key={tab.section}
                type="button"
                onClick={() => onOpenSection(tab.section)}
                className={`h-[30px] rounded-xl px-3 text-sm leading-[22px] tracking-[0px] transition-colors ${
                  active
                    ? 'bg-[#1d2129] font-normal text-white'
                    : 'bg-[#f2f3f5] font-normal text-[#4e5969] hover:bg-[#e5e6eb]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
