import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, Loader2, GripHorizontal, FileText, Code } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface OCRDialogProps {
  text: string;
  loading: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export const OCRDialog: React.FC<OCRDialogProps> = ({ text, loading, onClose, position }) => {
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState(position);
  const [size, setSize] = useState({ width: 360, height: 440 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(true);
  
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 同步外部传入的位置信息
  useEffect(() => {
    setPos(position);
  }, [position]);

  // 处理拖拽与缩放
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: e.clientX - dragOffsetRef.current.x,
          y: e.clientY - dragOffsetRef.current.y
        });
      } else if (isResizing) {
        const dw = e.clientX - resizeStartRef.current.x;
        const dh = e.clientY - resizeStartRef.current.y;
        setSize({
          width: Math.max(300, resizeStartRef.current.width + dw),
          height: Math.max(200, resizeStartRef.current.height + dh)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div 
      ref={containerRef}
      className={clsx(
          "fixed z-[100] bg-white dark:bg-zinc-900 rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200",
          isDragging && "opacity-90 select-none scale-[1.01] transition-transform",
          isResizing && "select-none"
      )}
      style={{ 
        left: Math.max(10, Math.min(pos.x, window.innerWidth - size.width - 10)), 
        top: Math.max(10, Math.min(pos.y, window.innerHeight - size.height - 10)),
        width: size.width,
        height: size.height
      }}
    >
      {/* 标题栏 (Header) */}
      <div 
          className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md cursor-move select-none"
          onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2.5">
            {loading ? (
                <Loader2 size={16} className="animate-spin text-blue-500" />
            ) : (
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                    <GripHorizontal size={14} className="text-blue-500" />
                </div>
            )}
            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">文字识别</span>
        </div>
        
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          {!loading && (
            <>
              <button 
                onClick={() => setShowMarkdown(!showMarkdown)}
                className={clsx(
                    "p-2 rounded-lg transition-all active:scale-95",
                    showMarkdown 
                        ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50" 
                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                )}
                title={showMarkdown ? "查看纯文本" : "预览 Markdown"}
              >
                {showMarkdown ? <Code size={16} /> : <FileText size={16} />}
              </button>
              <button 
                onClick={handleCopy}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all active:scale-95 text-zinc-500 dark:text-zinc-400 border border-transparent"
                title="复制全部"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </>
          )}
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1.5" />
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-lg transition-all active:scale-95 text-zinc-500 dark:text-zinc-400"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 内容区域 (Content) */}
      <div className="relative flex-1 flex flex-col min-h-0 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/30 dark:bg-zinc-900/30 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-4 text-zinc-500">
              <div className="relative">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <div className="absolute inset-0 blur-lg bg-blue-500/20 animate-pulse" />
              </div>
              <span className="text-sm font-medium animate-pulse tracking-wide">正在解析图像文字...</span>
            </div>
          </div>
        ) : (
          <div className="p-5 min-h-full">
            {showMarkdown ? (
              <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 break-words space-y-4">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                    p: ({children}) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                    h1: ({children}) => <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">{children}</h1>,
                    h2: ({children}) => <h2 className="text-lg font-bold mt-5 mb-2">{children}</h2>,
                    ul: ({children}) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
                    blockquote: ({children}) => <blockquote className="border-l-4 border-zinc-200 dark:border-zinc-700 pl-4 py-1 my-4 italic text-zinc-500 dark:text-zinc-400">{children}</blockquote>,
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : '';
                        
                        if (!inline && lang) {
                            return (
                                <div className="relative group my-5 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-zinc-50 dark:bg-black/20">
                                    <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-100/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang}</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(String(children))}
                                            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-all text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 active:scale-90"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    </div>
                                    <SyntaxHighlighter
                                        style={isDarkMode ? vscDarkPlus : prism}
                                        language={lang}
                                        PreTag="div"
                                        customStyle={{
                                            margin: 0,
                                            padding: '1.25rem',
                                            fontSize: '13px',
                                            lineHeight: '1.6',
                                            backgroundColor: 'transparent'
                                        }}
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }
                        return (
                            <code className={clsx(
                                "px-1.5 py-0.5 rounded-md font-mono text-[0.9em] font-medium",
                                isDarkMode ? "bg-zinc-800 text-blue-400" : "bg-blue-50 text-blue-600",
                                className
                            )} {...props}>
                                {children}
                            </code>
                        );
                    }
                    }}
                >
                    {text || '*未识别到有效文字*'}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-100">
                {text || '未识别到有效文字'}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* 缩放手柄 (Resize Handle) */}
      <div 
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1.5 group"
        onMouseDown={handleResizeStart}
      >
        <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-zinc-300 dark:border-zinc-700 rounded-br-sm group-hover:border-blue-500 transition-colors" />
      </div>
    </div>
  );
};
