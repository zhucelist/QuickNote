import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  showValue = true,
  valueFormatter = (v) => String(v),
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const handleMove = useCallback((clientX: number) => {
    if (!trackRef.current || disabled) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newPercentage = (x / rect.width) * 100;
    const newValue = min + (newPercentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    
    onChange(clampedValue);
  }, [min, max, step, onChange, disabled]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleMove(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMove]);

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {valueFormatter(value)}
            </span>
          )}
        </div>
      )}
      <div
        ref={trackRef}
        className={clsx(
          'relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Filled track */}
        <div
          className="absolute h-full bg-blue-500 rounded-full transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
        
        {/* Thumb */}
        <div
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
            'w-4 h-4 bg-white dark:bg-zinc-100 rounded-full shadow-md',
            'border-2 border-blue-500',
            'transition-transform duration-75',
            !disabled && 'hover:scale-110 cursor-grab active:cursor-grabbing active:scale-95',
            isDragging && 'scale-95 cursor-grabbing'
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default Slider;
