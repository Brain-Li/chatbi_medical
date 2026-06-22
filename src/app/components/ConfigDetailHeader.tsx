import { ArrowLeft, LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

type ConfigDetailHeaderMetaItem = {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'blue';
};

type ConfigDetailHeaderProps = {
  backLabel: string;
  onBack: () => void;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  metaItems?: ConfigDetailHeaderMetaItem[];
};

export function ConfigDetailHeader({
  backLabel,
  onBack,
  icon: Icon,
  title,
  subtitle,
  status,
  actions,
  metaItems = [],
}: ConfigDetailHeaderProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-6">
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                  {status}
                </div>
                {subtitle && <div className="mt-1 text-sm text-gray-500">{subtitle}</div>}
              </div>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>}
        </div>

        {!!metaItems.length && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            {metaItems.map((item) => (
              <span
                key={item.label}
                className={`rounded-full px-3 py-1 ${
                  item.tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {item.label}：{item.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
