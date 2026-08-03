import { useMemo, useState } from 'react';
import type { AgentType, Skill } from '../types';
import searchIcon from '../../assets/figma-agent-management/search-line.svg';
import addIcon from '../../assets/figma-agent-management/add-large-line.svg';
import editIcon from '../../assets/figma-agent-management/edit-2-line.svg';
import copyIcon from '../../assets/figma-agent-management/file-copy-line.svg';
import deleteIcon from '../../assets/figma-agent-management/delete-bin-line.svg';
import arrowDownIcon from '../../assets/figma-agent-management/arrow-down-s-line.svg';
import arrowLeftIcon from '../../assets/figma-agent-management/arrow-left-s-line.svg';
import arrowRightIcon from '../../assets/figma-agent-management/arrow-right-s-line.svg';

type SkillManagementSectionProps = {
  skills: Skill[];
  page: number;
  onPageChange: (page: number) => void;
  onOpenSection: (section: string) => void;
  onCreate: () => void;
  onEdit: (skill: Skill) => void;
  onCopy: (skillId: string) => void;
  onDelete: (skillId: string) => void;
  onUpdate: (skillId: string, updates: Partial<Skill>) => void;
};

const gridColumns = {
  gridTemplateColumns: '30.72% 10.17% 21.01% 21.01% 6.55% 10.54%',
};

const primaryTabs = [
  { label: '能力配置', section: 'agents' },
  { label: '语义资产', section: 'datasets' },
  { label: '平台接入', section: 'database' },
  { label: '系统设置', section: 'system' },
];

const secondaryTabs = [
  { label: 'Agent 管理', section: 'agents' },
  { label: 'Skill 管理', section: 'skills' },
  { label: 'MCP 接入', section: 'mcp' },
  { label: '知识库管理', section: 'knowledge' },
];

const agentTypeLabel: Record<AgentType, string> = {
  ask: '问数 Agent',
  report: '报告 Agent',
  rca: '深度分析 Agent',
};

const figmaDescriptions: Record<string, string> = {
  'skill-outpatient-ops': '汇总诊疗量、门诊收入及药品消耗结构，生成详细经营报告与优化建议。',
  'skill-pharmacy-structure': '识别药品、耗材及治疗费用结构，及时发现异常波动。',
  'skill-department-revenue': '按科室细分收入、检查、治疗及患者流量，助力精准管理。',
  'skill-abnormal-fee': '自动识别异常费用群组，提供潜在根因分析支持。',
  'skill-patient-flow': '基于时间和人群层级，动态监测患者流量变化趋势。',
};

const figmaScenes: Record<string, string> = {
  'skill-outpatient-ops': '问数 Agent',
};

function ActionIconButton({
  icon,
  iconClassName,
  label,
  onClick,
}: {
  icon: string;
  iconClassName: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[#f2f3f5]"
    >
      <span className="flex size-4 items-center justify-center overflow-hidden">
        <img src={icon} alt="" className={`max-w-none ${iconClassName}`} />
      </span>
    </button>
  );
}

export default function SkillManagementSection({
  skills,
  page,
  onPageChange,
  onOpenSection,
  onCreate,
  onEdit,
  onCopy,
  onDelete,
  onUpdate,
}: SkillManagementSectionProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) => {
        if (!normalizedQuery) return true;
        const description = figmaDescriptions[skill.id] ?? skill.description;
        return `${skill.name} ${description} ${skill.triggerPhrases.join(' ')}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [skills, normalizedQuery],
  );
  const visibleSkills = page === 1 ? filteredSkills.slice(0, 5) : [];

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-['PingFang_SC','Microsoft_YaHei',sans-serif] text-[#1d2129]"
      data-skill-management
    >
      <div className="shrink-0 px-[22px] pt-[22px]">
        <div className="flex h-10 items-start justify-between">
          <h1 className="mb-0 mr-0 text-xl font-semibold leading-7 tracking-[0px] text-[#1d2129]">配置中心</h1>
          <div className="-mt-1 flex items-center gap-3">
            <label className="flex h-10 w-60 items-center gap-2 rounded-xl border border-[#e5e6eb] px-[17px]">
              <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden">
                <img src={searchIcon} alt="" className="h-[14.67px] w-[14.67px] max-w-none" />
              </span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  onPageChange(1);
                }}
                placeholder="输入模板名称或触发词"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-[22px] text-[#1d2129] outline-none placeholder:text-[#86909c]"
              />
            </label>
            <button
              type="button"
              onClick={onCreate}
              className="flex h-[38px] items-center gap-1 rounded-xl border border-[#e5e6eb] bg-white px-3 text-sm leading-[22px] tracking-[0.15px] text-[#4e5969] transition-colors hover:bg-[#f7f8fa]"
            >
              <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden">
                <img src={addIcon} alt="" className="h-[13.33px] w-[13.33px] max-w-none" />
              </span>
              <span>新建 Skill</span>
            </button>
          </div>
        </div>

        <nav className="mt-4 flex h-10 items-start gap-6 border-b border-[#e5e6eb]" aria-label="配置中心分类">
          {primaryTabs.map((tab) => {
            const active = tab.section === 'agents';
            return (
              <button
                key={tab.section}
                type="button"
                onClick={() => onOpenSection(tab.section)}
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

        <nav className="mt-4 flex h-[30px] items-center gap-3" aria-label="能力配置分类">
          {secondaryTabs.map((tab) => {
            const active = tab.section === 'skills';
            return (
              <button
                key={tab.section}
                type="button"
                onClick={() => onOpenSection(tab.section)}
                className={`h-[30px] rounded-xl px-3 text-sm font-normal leading-[22px] tracking-[0px] transition-colors ${
                  active
                    ? 'border border-[#1d2129] bg-[#1d2129] text-white'
                    : 'border border-[#f7f8fa] bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 px-[22px] pt-4">
        <div
          className="grid h-12 border-b border-[#e5e6eb] bg-[#f7f8fa] text-sm font-medium leading-6 text-[#4e5969]"
          style={gridColumns}
        >
          {['Skill 名称', '场景', '适用 Agent', '触发词', '状态', '操作'].map((label) => (
            <div key={label} className="flex min-w-0 items-center whitespace-nowrap px-4">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 flex min-h-0 flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleSkills.map((skill) => {
            const enabled = skill.status === '已启用';
            return (
              <div
                key={skill.id}
                className="grid h-[72px] shrink-0 border-b border-[#e5e6eb] bg-white text-sm leading-[22px] text-[#4e5969]"
                style={gridColumns}
              >
                <div className="flex min-w-0 flex-col justify-center gap-1 overflow-hidden px-4">
                  <div className="truncate text-base font-medium leading-6 text-[#1d2129]">{skill.name}</div>
                  <div className="truncate text-sm leading-5 text-[#86909c]">
                    {figmaDescriptions[skill.id] ?? skill.description}
                  </div>
                </div>
                <div className="flex min-w-0 items-center overflow-hidden px-4 text-[#1d2129]">
                  <span className="truncate">{figmaScenes[skill.id] ?? skill.scene}</span>
                </div>
                <div className="flex min-w-0 items-center overflow-hidden px-4">
                  <span className="line-clamp-2">{skill.applicableAgentTypes.map((type) => agentTypeLabel[type]).join('、')}</span>
                </div>
                <div className="flex min-w-0 items-center overflow-hidden px-4">
                  <span className="line-clamp-2">{skill.triggerPhrases.join(' / ') || '-'}</span>
                </div>
                <div className="flex min-w-0 items-center px-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${skill.name}当前${skill.status}`}
                    title={enabled ? '点击停用' : '点击启用'}
                    onClick={() => onUpdate(skill.id, { status: enabled ? '已停用' : '已启用' })}
                    className={`relative h-5 w-10 rounded-xl transition-colors ${enabled ? 'bg-[#1d2129]' : 'bg-[#c9cdd4]'}`}
                  >
                    <span
                      className={`absolute rounded-full bg-white shadow-[0_2px_4px_-1px_rgba(0,0,0,0.12),0_4px_5px_rgba(0,0,0,0.08),0_1px_10px_rgba(0,0,0,0.05)] transition-[left] ${
                        enabled ? 'left-[22.5px] top-[2.5px] size-[15px]' : 'left-1 top-1 size-3'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex min-w-0 items-center gap-2 px-4">
                  <ActionIconButton
                    icon={editIcon}
                    iconClassName="h-[11.98px] w-3"
                    label="编辑"
                    onClick={() => onEdit(skill)}
                  />
                  <ActionIconButton
                    icon={copyIcon}
                    iconClassName="h-[13.33px] w-3"
                    label="复制"
                    onClick={() => onCopy(skill.id)}
                  />
                  <ActionIconButton
                    icon={deleteIcon}
                    iconClassName="h-[13.33px] w-[13.33px]"
                    label="删除"
                    onClick={() => onDelete(skill.id)}
                  />
                </div>
              </div>
            );
          })}
          {!visibleSkills.length && (
            <div className="flex h-[72px] items-center justify-center border-b border-[#e5e6eb] text-sm text-[#86909c]">
              暂无匹配的 Skill
            </div>
          )}
        </div>
      </div>

      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[#e5e6eb] bg-[#f7f8fa] px-6 text-sm text-[#1d2129]">
        <div className="flex items-center gap-4">
          <span>共 100 条</span>
          <button type="button" className="flex h-8 items-center gap-2.5 rounded-lg border border-[#e5e6eb] px-2 text-[#4e5969]">
            <span>10 条/页</span>
            <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden">
              <img src={arrowDownIcon} alt="" className="h-[5.19px] w-[8.49px] max-w-none" />
            </span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              aria-label="上一页"
              className="flex size-8 items-center justify-center rounded-lg border border-[#f2f3f5] bg-[#f7f8fa]"
            >
              <span className="flex size-6 items-center justify-center overflow-hidden">
                <img src={arrowLeftIcon} alt="" className="h-[12.73px] w-[7.78px] max-w-none" />
              </span>
            </button>
            {[1, 2, 3].map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={`flex size-8 items-center justify-center rounded-lg border text-center ${
                  page === pageNumber
                    ? 'border-[#1d2129] bg-[#1d2129] font-medium text-white'
                    : 'border-[#f2f3f5] bg-transparent text-[#4e5969]'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <span className="flex size-8 items-center justify-center text-[#4e5969]">...</span>
            <button
              type="button"
              onClick={() => onPageChange(10)}
              className={`flex size-8 items-center justify-center rounded-lg border ${
                page === 10 ? 'border-[#1d2129] bg-[#1d2129] text-white' : 'border-[#f2f3f5] text-[#4e5969]'
              }`}
            >
              10
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(10, page + 1))}
              aria-label="下一页"
              className="flex size-8 items-center justify-center rounded-lg border border-[#f2f3f5] bg-[#f7f8fa]"
            >
              <span className="flex size-6 items-center justify-center overflow-hidden">
                <img src={arrowRightIcon} alt="" className="h-[12.73px] w-[7.78px] max-w-none" />
              </span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label htmlFor="skill-page-jump">跳至</label>
            <input
              id="skill-page-jump"
              inputMode="numeric"
              aria-label="跳转页码"
              className="h-8 w-11 rounded-lg border border-[#e5e6eb] bg-transparent px-2 text-center outline-none"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                const target = Number(event.currentTarget.value);
                if (Number.isInteger(target) && target >= 1 && target <= 10) onPageChange(target);
              }}
            />
            <span className="text-[#4e5969]">页</span>
          </div>
        </div>
      </footer>
    </section>
  );
}
