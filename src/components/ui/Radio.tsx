import React from 'react';
import clsx from 'clsx';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioProps {
  options: RadioOption[];
  value?: string;
  onChange: (value: string) => void;
  name: string;
  direction?: 'vertical' | 'horizontal';
}

export const Radio: React.FC<RadioProps> = ({
  options,
  value,
  onChange,
  name,
  direction = 'vertical',
}) => {
  return (
    <div className={clsx('flex', direction === 'vertical' ? 'flex-col gap-3' : 'flex-row gap-6 flex-wrap')}>
      {options.map((option) => (
        <label
          key={option.value}
          className={clsx(
            'flex items-start gap-3 cursor-pointer group',
            option.disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="relative flex items-center mt-0.5">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={option.disabled}
              className="peer sr-only"
            />
            <div
              className={clsx(
                'w-5 h-5 rounded-full border-2 transition-all duration-200',
                value === option.value
                  ? 'border-blue-500'
                  : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400 dark:group-hover:border-zinc-500'
              )}
            >
              {value === option.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <span className={clsx(
              'text-sm font-medium transition-colors',
              value === option.value
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
            )}>
              {option.label}
            </span>
            {option.description && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {option.description}
              </span>
            )}
          </div>
        </label>
      ))}
    </div>
  );
};

export default Radio;
