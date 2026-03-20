import React from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  indeterminate?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  indeterminate,
  className,
  checked,
  ...props
}) => {
  return (
    <label className={clsx('flex items-start gap-3 cursor-pointer group', className)}>
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          {...props}
        />
        <div
          className={clsx(
            'w-5 h-5 rounded border-2 transition-all duration-200',
            'flex items-center justify-center',
            checked
              ? 'bg-blue-500 border-blue-500'
              : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
          )}
        >
          {checked && !indeterminate && (
            <Check size={12} className="text-white" strokeWidth={3} />
          )}
          {indeterminate && (
            <div className="w-2.5 h-0.5 bg-white rounded-full" />
          )}
        </div>
      </div>
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
    </label>
  );
};

export default Checkbox;
