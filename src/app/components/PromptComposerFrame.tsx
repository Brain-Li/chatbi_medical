import { type ReactNode } from 'react';

type PromptComposerFrameProps = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function PromptComposerFrame({
  children,
  className = '',
  bodyClassName = '',
}: PromptComposerFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-[16px] border border-[#edeff1] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)] ${className}`}
    >
      <div className={`flex flex-col gap-3 px-[13.5px] py-[13.5px] ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
