import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
}

const DEFAULT_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#52525b', '#3f3f46', '#18181b',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  presetColors = DEFAULT_PRESETS,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
        >
          <div
            className="w-6 h-6 rounded-md border border-zinc-200 dark:border-zinc-700 shadow-sm"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300 font-mono uppercase">
            {value}
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl animate-fade-in-down">
            {/* Preset colors */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChange(color);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-8 h-8 rounded-lg border-2 transition-all duration-150',
                    value.toLowerCase() === color.toLowerCase()
                      ? 'border-zinc-900 dark:border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Custom color input */}
            <div className="flex items-center gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono uppercase"
                placeholder="#000000"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;
