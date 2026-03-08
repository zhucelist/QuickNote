import { useEffect, useRef, useState } from 'react';
import { useClipboardStore, ClipboardItem } from '../store/clipboard';
import { Search, Copy, Image, Type, Trash2, Check, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { ClipboardImage } from './ClipboardImage';

export const ClipboardList = () => {
  const { history, searchQuery, setSearchQuery, copyItem, clearHistory, setHistory } = useClipboardStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // 设置监听器以接收主进程的更新
    const handleUpdate = (_event: unknown, newHistory: ClipboardItem[]) => {
      setHistory(newHistory);
    };
    
    // 初始获取
    window.ipcRenderer.invoke('get-clipboard-history').then(setHistory);

    // 订阅更新
    window.ipcRenderer.on('clipboard-update', handleUpdate);

    return () => {
      window.ipcRenderer.off('clipboard-update', handleUpdate);
    };
  }, [setHistory]);

  const handleCopy = (item: ClipboardItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    copyItem(item);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 置顶功能已移除

  const decodeContent = (content: string) => {
    try {
      // 简单判断是否是编码后的 URL
      if (/%[0-9A-F]{2}/i.test(content)) {
        return decodeURIComponent(content);
      }
      return content;
    } catch (e) {
      return content;
    }
  };

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlightMatches = (text: string, query: string) => {
    if (!query) return text;
    const re = new RegExp(`(${escapeRegExp(query)})`, 'ig');
    const parts = text.split(re);
    return parts.map((part, idx) =>
      re.test(part)
        ? <span key={idx} className="text-red-600 dark:text-red-400 font-semibold">{part}</span>
        : <span key={idx}>{part}</span>
    );
  };

  const isLikelyCode = (text: string) => {
    const t = text.trim();
    if (!t) return false;
    if (/function\s|\bclass\s|\bconst\s|\blet\s|\bvar\s|=>/.test(t)) return true;
    if (/#include|int\s+main|public\s+class|package\s+|def\s+\w+/.test(t)) return true;
    if (/[{[\]}();<>]/.test(t) && /[=:+\-*/]/.test(t)) return true;
    if (t.includes('\n') && / {2,}|\t/.test(t)) return true;
    return false;
  };

  const filteredHistory = history.filter((item) => {
    // 不区分大小写的搜索
    const query = searchQuery.toLowerCase();
    
    if (item.type === 'text') {
      const decoded = decodeContent(item.content);
      return decoded.toLowerCase().includes(query);
    } else if (item.type === 'image') {
      return query === '';
    }
    return true;
  });

  // Virtual windowing
  const containerRef = useRef<HTMLDivElement>(null);
  const EST_ROW = 110;
  const OVERSCAN = 6;
  const [range, setRange] = useState({ start: 0, end: Math.min(20, filteredHistory.length) });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollTop = el.scrollTop;
      const height = el.clientHeight;
      const start = Math.max(0, Math.floor(scrollTop / EST_ROW) - OVERSCAN);
      const visible = Math.ceil(height / EST_ROW) + OVERSCAN * 2;
      const end = Math.min(filteredHistory.length, start + visible);
      setRange((prev) => (prev.start === start && prev.end === end) ? prev : { start, end });
    };
    onScroll();
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [filteredHistory.length]);

  useEffect(() => {
    // Reset range when list shrinks
    setRange({ start: 0, end: Math.min(20, filteredHistory.length) });
  }, [searchQuery, filteredHistory.length]);

  const padTop = range.start * EST_ROW;
  const padBottom = Math.max(0, (filteredHistory.length - range.end) * EST_ROW);

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* 头部 */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-md px-3 py-2 border border-zinc-200 dark:border-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-700 transition-all shadow-sm dark:shadow-none">
          <Search size={16} className="text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="搜索剪切板历史..."
            className="bg-transparent border-none outline-none flex-1 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 列表 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 gap-2">
            <Search size={32} className="opacity-20" />
            <span className="text-sm">暂无历史记录</span>
          </div>
        ) : (
          <div style={{ paddingTop: padTop, paddingBottom: padBottom }} className="space-y-3">
          {filteredHistory.slice(range.start, range.end).map((item) => (
            <div
              key={item.id}
              className="group relative bg-white dark:bg-zinc-900/50 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-sm"
              onClick={() => handleCopy(item)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 text-zinc-400 dark:text-zinc-500 shrink-0 relative">
                  {item.type === 'text' ? <Type size={16} /> : <Image size={16} />}
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                  {item.type === 'text' ? (
                    isLikelyCode(decodeContent(item.content)) ? (
                      <pre className="text-[12px] md:text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3 break-words font-mono leading-relaxed whitespace-pre-wrap">
                        {highlightMatches(decodeContent(item.content), searchQuery)}
                      </pre>
                    ) : (
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3 break-words leading-relaxed">
                        {highlightMatches(decodeContent(item.content), searchQuery)}
                      </p>
                    )
                  ) : (
                    <div className="bg-zinc-100 dark:bg-zinc-950/50 rounded-md border border-zinc-200 dark:border-zinc-800/50 p-1 inline-block max-w-full">
                      <ClipboardImage dataUrl={item.content} maxWidth={480} maxHeight={160} />
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
              
              <div className={clsx(
                "absolute top-3 right-3 transition-all transform flex gap-2",
                // 显示条件：已复制或悬停
                (copiedId === item.id) ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
              )}>
                <button 
                  className={clsx(
                    "p-2 rounded-md transition-all shadow-sm border",
                    "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md hover:scale-105 active:scale-95 border-zinc-200 dark:border-zinc-700"
                  )}
                  title={item.type === 'image' ? "贴图到屏幕（图片）" : "贴图到屏幕（文本）"}
                  aria-label={item.type === 'image' ? "贴图到屏幕（图片）" : "贴图到屏幕（文本）"}
                  onClick={(e) => {
                      e.stopPropagation();
                      window.ipcRenderer.send('pin-clipboard-image', item);
                  }}
                  // hidden={item.type !== 'image'} // Allow all types to be pinned
                >
                    <Monitor size={16} />
                </button>
                <button 
                  className={clsx(
                    "p-2 rounded-md transition-all shadow-sm border",
                    copiedId === item.id
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 scale-105"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md hover:scale-105 active:scale-95 border-zinc-200 dark:border-zinc-700"
                  )}
                  title={copiedId === item.id ? "已复制" : "复制到剪切板"}
                  aria-label={copiedId === item.id ? "已复制" : "复制到剪切板"}
                  onClick={(e) => handleCopy(item, e)}
                >
                  {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/50 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-sm flex justify-between items-center text-xs text-zinc-500 font-medium transition-colors duration-200">
        <span className="px-2">{history.length} 条记录</span>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors text-zinc-500"
        >
          <Trash2 size={14} />
          清空全部
        </button>
      </div>
    </div>
  );
};
