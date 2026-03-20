import { useEffect, useRef, useState } from 'react';
import { useClipboardStore, ClipboardItem } from '../store/clipboard';
import { Search, Copy, Image, Type, Trash2, Check, Monitor, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { ClipboardImage } from './ClipboardImage';

export const ClipboardList = () => {
  const { history, searchQuery, setSearchQuery, copyItem, clearHistory, setHistory } = useClipboardStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = (_event: unknown, newHistory: ClipboardItem[]) => {
      setHistory(newHistory);
    };
    
    window.ipcRenderer.invoke('get-clipboard-history').then(setHistory);
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

  const decodeContent = (content: string) => {
    try {
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
        ? <span key={idx} className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium px-0.5 rounded">{part}</span>
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
    const query = searchQuery.toLowerCase();
    
    if (item.type === 'text') {
      const decoded = decodeContent(item.content);
      return decoded.toLowerCase().includes(query);
    } else if (item.type === 'image') {
      return query === '';
    }
    return true;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-50/50 dark:bg-zinc-950/50">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">剪切板历史</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">管理和搜索您的剪切板记录</p>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索剪切板内容..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-transparent focus:border-blue-500 dark:focus:border-blue-400 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 列表 */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400 dark:text-zinc-500">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 opacity-40" />
            </div>
            <span className="text-sm font-medium">暂无历史记录</span>
            <span className="text-xs mt-1">复制内容后将自动保存到这里</span>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group relative bg-white dark:bg-zinc-900 rounded-xl p-4 hover:shadow-lg dark:hover:shadow-zinc-800/50 transition-all duration-200 cursor-pointer border border-zinc-200 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800/50"
                onClick={() => handleCopy(item)}
              >
                <div className="flex items-start gap-4">
                  <div className={clsx(
                    "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    item.type === 'text' 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500" 
                      : "bg-purple-50 dark:bg-purple-900/20 text-purple-500"
                  )}>
                    {item.type === 'text' ? <Type size={16} /> : <Image size={16} />}
                  </div>
                  
                  <div className="flex-1 overflow-hidden min-w-0 pr-20">
                    {item.type === 'text' ? (
                      isLikelyCode(decodeContent(item.content)) ? (
                        <pre className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3 break-words font-mono leading-relaxed whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                          {highlightMatches(decodeContent(item.content), searchQuery)}
                        </pre>
                      ) : (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3 break-words leading-relaxed">
                          {highlightMatches(decodeContent(item.content), searchQuery)}
                        </p>
                      )
                    ) : (
                      <div className="inline-block max-w-full">
                        <ClipboardImage dataUrl={item.content} maxWidth={400} maxHeight={140} />
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* 操作按钮 */}
                <div className={clsx(
                  "absolute top-4 right-4 flex gap-2 transition-all duration-200",
                  copiedId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <button 
                    className="p-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-zinc-200 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-800/50 transition-all shadow-sm"
                    title="贴图到屏幕"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.ipcRenderer.send('pin-clipboard-image', item);
                    }}
                  >
                    <Monitor size={16} />
                  </button>
                  <button 
                    className={clsx(
                      "p-2 rounded-lg border transition-all shadow-sm",
                      copiedId === item.id
                        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                        : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-zinc-200 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-800/50"
                    )}
                    title={copiedId === item.id ? "已复制" : "复制"}
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
      <div className="mt-auto px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl flex justify-between items-center z-10 shrink-0">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          共 <span className="font-medium text-zinc-700 dark:text-zinc-300">{history.length}</span> 条记录
        </span>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          清空
        </button>
      </div>
    </div>
  );
};
