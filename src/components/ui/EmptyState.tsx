import React from 'react';
import clsx from 'clsx';
import { FolderOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FolderOpen size={48} />,
  title = '暂无数据',
  description = '这里还没有任何内容',
  action,
  className,
}) => {
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className="mb-4 text-zinc-300 dark:text-zinc-600">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm">
        {description}
      </p>
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
