import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from './ui/utils';

type ConfigActionVariant = 'view' | 'edit' | 'delete' | 'copy' | 'test' | 'sync' | 'neutral';

const actionVariantClass: Record<ConfigActionVariant, string> = {
  view: 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-blue-100',
  edit: 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 focus-visible:ring-amber-100',
  delete: 'text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-100',
  copy: 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-100',
  test: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-emerald-100',
  sync: 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:ring-cyan-100',
  neutral: 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-gray-100',
};

type ConfigActionIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: LucideIcon;
  label: string;
  iconClassName?: string;
  variant?: ConfigActionVariant;
};

export function ConfigActionIconButton({
  icon: Icon,
  label,
  iconClassName,
  variant = 'neutral',
  className,
  type = 'button',
  disabled,
  ...props
}: ConfigActionIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type={type}
          aria-label={label}
          title={label}
          disabled={disabled}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
            actionVariantClass[variant],
            className,
          )}
          {...props}
        >
          <Icon className={cn('h-4 w-4', iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
