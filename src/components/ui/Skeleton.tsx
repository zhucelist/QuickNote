import React from 'react';
import clsx from 'clsx';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  circle = false,
  className,
  count = 1,
}) => {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={clsx(
            'bg-zinc-200 dark:bg-zinc-800 animate-pulse',
            circle ? 'rounded-full' : 'rounded-md',
            className
          )}
          style={style}
        />
      ))}
    </>
  );
};

// 预定义的骨架屏布局
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('p-4 rounded-xl border border-zinc-200 dark:border-zinc-800', className)}>
    <div className="flex items-center gap-3 mb-3">
      <Skeleton width={40} height={40} circle />
      <div className="flex-1">
        <Skeleton width="60%" height={16} className="mb-2" />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
    <Skeleton width="100%" height={80} className="mb-3" />
    <div className="flex gap-2">
      <Skeleton width={60} height={24} />
      <Skeleton width={60} height={24} />
    </div>
  </div>
);

export const SkeletonList: React.FC<{ rows?: number; className?: string }> = ({ 
  rows = 5, 
  className 
}) => (
  <div className={clsx('space-y-3', className)}>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="flex items-center gap-3 p-3">
        <Skeleton width={32} height={32} circle />
        <div className="flex-1">
          <Skeleton width="70%" height={14} className="mb-2" />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className 
}) => (
  <div className={clsx('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton 
        key={index} 
        width={index === lines - 1 ? '60%' : '100%'} 
        height={12} 
      />
    ))}
  </div>
);

export default Skeleton;
