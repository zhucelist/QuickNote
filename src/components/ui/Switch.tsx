import React from 'react';
import clsx from 'clsx';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  description,
  className,
  checked,
  ...props
}) => {
  return (
    <label className={clsx('flex items-center justify-between gap-4 cursor-pointer group', className)}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {description}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          {...props}
        />
        <div
          className={clsx(
            'w-11 h-6 rounded-full transition-all duration-300 ease-in-out',
            'bg-zinc-200 dark:bg-zinc-700 peer-focus:ring-2 peer-focus:ring-blue-500/30',
            'peer-checked:bg-blue-500 dark:peer-checked:bg-blue-600',
            'after:content-[""] after:absolute after:top-0.5 after:left-0.5',
            'after:bg-white after:rounded-full after:h-5 after:w-5',
            'after:transition-all after:duration-300 after:ease-in-out',
            'peer-checked:after:translate-x-5 peer-checked:after:left-[2px]',
            'hover:bg-zinc-300 dark:hover:bg-zinc-600',
            'peer-checked:hover:bg-blue-600 dark:peer-checked:hover:bg-blue-500'
          )}
        />
      </div>
    </label>
  );
};

export default Switch;
