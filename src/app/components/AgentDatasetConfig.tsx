import { useState } from 'react';
import { Search } from 'lucide-react';
import type { SemanticDataset } from '../types';

export default function AgentDatasetConfig({ datasets, selectedIds, onChange }: {
  datasets: SemanticDataset[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const categories = ['全部', '301 医疗数据集', '汽车VOC', '云管经营'];
  const visibleDatasets = datasets.filter((dataset) => {
    const source = dataset.sourceName;
    const matchesCategory = category === '全部' || (category === '301 医疗数据集' ? source === '医疗数据' || source === category : source === category);
    return matchesCategory && `${dataset.name} ${dataset.description}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  return <div className="mt-4 space-y-4">
    <div>
      <h2 className="text-base font-semibold text-[#1d2129]">可访问数据集</h2>
      <p className="mt-1 text-xs leading-5 text-[#86909c]">数据集决定 Agent 的可问范围；指标口径会由语义层按问题自动识别。</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span aria-live="polite" className="text-sm text-[#4e5969]">已选 {selectedIds.length} 个数据集</span>
      <label className="flex h-10 w-[240px] max-w-full items-center gap-2 rounded-xl border border-[#e5e6eb] px-3 focus-within:border-[#86909c]">
        <Search aria-hidden="true" className="size-4 shrink-0 text-[#86909c]" />
        <input aria-label="搜索数据集" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索数据集名称或描述" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#86909c]" />
      </label>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="数据集分类">
      {categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`rounded-xl px-3 py-1.5 text-sm ${category === item ? 'bg-[#1d2129] text-white' : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'}`}>{item}</button>)}
    </div>
    <div className="space-y-3">
      {visibleDatasets.map((dataset) => {
        const selected = selectedIds.includes(dataset.id);
        return <div key={dataset.id} className="rounded-xl border border-[#e5e6eb] p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="break-words text-base font-medium text-[#1d2129]">{dataset.name}</h3>
            <button type="button" role="switch" aria-checked={selected} aria-label={`允许访问${dataset.name}`} onClick={() => onChange(selected ? selectedIds.filter((id) => id !== dataset.id) : [...selectedIds, dataset.id])} className={`relative mt-0.5 h-5 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c] focus-visible:ring-offset-2 ${selected ? 'bg-[#1d2129]' : 'bg-[#c9cdd4]'}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${selected ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[dataset.businessTheme, dataset.sourceName].filter(Boolean).map((tag, index) => <span key={`${tag}-${index}`} className="rounded bg-[#f7f8fa] px-2 py-1 text-xs text-[#86909c]">{tag}</span>)}
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-[#86909c]">{dataset.description || '暂无描述'}</p>
        </div>;
      })}
      {!visibleDatasets.length && <p className="py-10 text-center text-sm text-[#86909c]">暂无匹配的数据集</p>}
    </div>
  </div>;
}
