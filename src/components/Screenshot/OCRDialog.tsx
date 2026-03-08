import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, Loader2, GripHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { ZoomableContainer } from '../common/ZoomableContainer';

interface OCRDialogProps {
  text: string;
  loading: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export const OCRDialog: React.FC<OCRDialogProps> = ({ text, loading, onClose, position }) => {
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPos(position);
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
      // 只有在 header 上点击才开始拖拽
      if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('button')) {
          return;
      }
      setIsDragging(true);
      dragOffsetRef.current = {
          x: e.clientX - pos.x,
          y: e.clientY - pos.y
      };
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      ref={containerRef}
      className={clsx(
          "fixed z-[100] bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200",
          "w-80 h-auto min-h-[160px] max-h-[500px] resize-y" // Allow resize
      )}
      style={{ 
        left: Math.min(pos.x, window.innerWidth - 340), 
        top: Math.min(pos.y, window.innerHeight - 300) 
      }}
    >
      {/* Header */}
      <div 
          className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 cursor-move select-none"
          onMouseDown={handleMouseDown}
      >
        <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          {loading ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <GripHorizontal size={14} className="text-zinc-400" />}
          文字识别
        </h3>
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          {!loading && (
            <button 
              onClick={handleCopy}
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-zinc-500 dark:text-zinc-400"
              title="复制全部"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 rounded-md transition-colors text-zinc-500 dark:text-zinc-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm p-8">
            <div className="flex flex-col items-center gap-3 text-zinc-500 text-sm">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span>正在识别中...</span>
            </div>
          </div>
        ) : (
          <ZoomableContainer 
             initialScale={1} 
             minScale={0.5} 
             maxScale={3}
             className="w-full h-full"
             enableDrag={false} // Textarea needs selection, so disable container drag
          >
            <textarea 
                className="flex-1 w-full h-full p-4 resize-none bg-transparent outline-none text-sm text-zinc-700 dark:text-zinc-300 font-mono leading-relaxed"
                value={text}
                readOnly
                spellCheck={false}
            />
          </ZoomableContainer>
        )}
      </div>
    </div>
  );
};
