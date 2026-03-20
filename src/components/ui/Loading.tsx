import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text = '加载中...',
  fullScreen = false,
  className,
}) => {
  const sizes = {
    sm: { icon: 16, text: 'text-xs' },
    md: { icon: 24, text: 'text-sm' },
    lg: { icon: 32, text: 'text-base' },
  };

  const { icon, text: textSize } = sizes[size];

  const content = (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      <Loader2 size={icon} className="animate-spin text-blue-500" />
      {text && (
        <span className={clsx(textSize, 'text-zinc-500 dark:text-zinc-400')}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm z-50">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;
