import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '请选择...',
  label,
  error,
  helper,
  fullWidth = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={clsx(
            'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left',
            'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'transition-all duration-200',
            error
              ? 'border-red-300 dark:border-red-700'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={clsx('truncate', !selectedOption && 'text-zinc-400 dark:text-zinc-500')}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            size={16}
            className={clsx(
              'text-zinc-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg animate-fade-in-down">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                disabled={option.disabled}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
                  'hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors',
                  option.disabled && 'opacity-50 cursor-not-allowed',
                  value === option.value && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                )}
              >
                {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                <span className="flex-1 truncate">{option.label}</span>
                {value === option.value && (
                  <Check size={14} className="text-blue-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {(error || helper) && (
        <p className={clsx('text-xs', error ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400')}>
          {error || helper}
        </p>
      )}
    </div>
  );
};

export default Select;
