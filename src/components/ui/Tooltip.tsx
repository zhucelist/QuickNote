import React, { useState } from 'react';
import clsx from 'clsx';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrows = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-800 dark:border-t-zinc-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800 dark:border-b-zinc-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-800 dark:border-l-zinc-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-800 dark:border-r-zinc-700',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={clsx(
            'absolute z-50 px-2 py-1 text-xs text-white',
            'bg-zinc-800 dark:bg-zinc-700 rounded-md shadow-lg',
            'whitespace-nowrap pointer-events-none',
            'animate-fade-in',
            positions[position]
          )}
        >
          {content}
          <span
            className={clsx(
              'absolute w-0 h-0 border-4 border-transparent',
              arrows[position]
            )}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
