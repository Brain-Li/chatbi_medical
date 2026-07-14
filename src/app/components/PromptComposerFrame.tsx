import { type ReactNode } from 'react';

type PromptComposerFrameProps = {
  children: ReactNode;
  className?: string;
};

export function PromptComposerFrame({ children, className = '' }: PromptComposerFrameProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-[16px] border-[1.5px] border-[#edeff1] bg-white px-[13.5px] py-[13.5px] shadow-[0_14px_14.1px_rgba(0,0,0,0.11)] ${className}`}
    >
      {children}
    </div>
  );
}
