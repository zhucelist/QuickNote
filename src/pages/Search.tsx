import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search as SearchIcon, File, AppWindow, Folder, Command, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SearchResult {
  id: string;
  name: string;
  path: string;
  type: 'app' | 'file' | 'folder';
  icon?: string;
  preview?: string;
}

// 文件类型图标映射
const fileTypeIcons: Record<string, { color: string; bg: string; label: string }> = {
  // 办公文档
  doc: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Word' },
  docx: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Word' },
  xls: { color: 'text-green-600', bg: 'bg-green-50', label: 'Excel' },
  xlsx: { color: 'text-green-600', bg: 'bg-green-50', label: 'Excel' },
  ppt: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'PPT' },
  pptx: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'PPT' },
  pdf: { color: 'text-red-600', bg: 'bg-red-50', label: 'PDF' },
  // 代码文件
  js: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'JS' },
  jsx: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'JSX' },
  ts: { color: 'text-blue-500', bg: 'bg-blue-50', label: 'TS' },
  tsx: { color: 'text-blue-500', bg: 'bg-blue-50', label: 'TSX' },
  py: { color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Python' },
  java: { color: 'text-red-500', bg: 'bg-red-50', label: 'Java' },
  html: { color: 'text-orange-500', bg: 'bg-orange-50', label: 'HTML' },
  css: { color: 'text-blue-400', bg: 'bg-blue-50', label: 'CSS' },
  json: { color: 'text-gray-600', bg: 'bg-gray-50', label: 'JSON' },
  // 图片
  png: { color: 'text-purple-600', bg: 'bg-purple-50', label: '图片' },
  jpg: { color: 'text-purple-600', bg: 'bg-purple-50', label: '图片' },
  jpeg: { color: 'text-purple-600', bg: 'bg-purple-50', label: '图片' },
  gif: { color: 'text-purple-600', bg: 'bg-purple-50', label: 'GIF' },
  svg: { color: 'text-purple-600', bg: 'bg-purple-50', label: 'SVG' },
  // 视频
  mp4: { color: 'text-pink-600', bg: 'bg-pink-50', label: '视频' },
  mov: { color: 'text-pink-600', bg: 'bg-pink-50', label: '视频' },
  // 音频
  mp3: { color: 'text-indigo-600', bg: 'bg-indigo-50', label: '音频' },
  wav: { color: 'text-indigo-600', bg: 'bg-indigo-50', label: '音频' },
  // 压缩包
  zip: { color: 'text-amber-600', bg: 'bg-amber-50', label: '压缩' },
  rar: { color: 'text-amber-600', bg: 'bg-amber-50', label: '压缩' },
  '7z': { color: 'text-amber-600', bg: 'bg-amber-50', label: '压缩' },
  // 文本
  txt: { color: 'text-gray-500', bg: 'bg-gray-50', label: '文本' },
  md: { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Markdown' },
  // 默认
  default: { color: 'text-gray-500', bg: 'bg-gray-50', label: '文件' }
};

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [homeDir, setHomeDir] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleReset = () => {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleItemDeleted = (_: unknown, deletedPath: string) => {
      if (!deletedPath) return;
      setResults(prev => prev.filter(item => item.path !== deletedPath));
    };

    // 处理异步图标更新
    const handleIconUpdated = (_: unknown, data: { path: string; icon: string }) => {
      if (!data?.path || !data?.icon) return;
      
      setResults(prev => {
        const index = prev.findIndex(item => item.path === data.path);
        if (index === -1) return prev;
        
        const newResults = [...prev];
        newResults[index] = { ...newResults[index], icon: data.icon };
        return newResults;
      });
    };

    window.ipcRenderer.on('search-reset', handleReset);
    window.ipcRenderer.on('search-item-deleted', handleItemDeleted);
    window.ipcRenderer.on('search-icon-updated', handleIconUpdated);

    return () => {
      window.ipcRenderer.off('search-reset', handleReset);
      window.ipcRenderer.off('search-item-deleted', handleItemDeleted);
      window.ipcRenderer.off('search-icon-updated', handleIconUpdated);
    };
  }, []);

  useEffect(() => {
    window.ipcRenderer.invoke('get-home-dir').then((dir: string) => {
      if (typeof dir === 'string') setHomeDir(dir);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      const trimmedQuery = query.trim();
      
      window.ipcRenderer.invoke('perform-search', trimmedQuery).then((data: SearchResult[]) => {
        if (requestId !== requestIdRef.current) return;
        setResults(data || []);
        setSelectedIndex(0);
        setIsLoading(false);
      }).catch((err: Error) => {
        if (requestId !== requestIdRef.current) return;
        console.error('Search failed:', err);
        setResults([]);
        setSelectedIndex(0);
        setIsLoading(false);
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  // 滚动选中项到视图
  useEffect(() => {
    if (results.length === 0 || selectedIndex < 0) return;
    
    const container = resultsContainerRef.current;
    if (!container) return;
    
    const selectedElement = container.querySelector(`[data-result-index="${selectedIndex}"]`) as HTMLElement | null;
    if (!selectedElement) return;
    
    const containerRect = container.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();
    
    if (elementRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - elementRect.top + 10;
    } else if (elementRect.bottom > containerRect.bottom) {
      container.scrollTop += elementRect.bottom - containerRect.bottom + 10;
    }
  }, [selectedIndex, results.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (results.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.ipcRenderer.invoke('hide-search');
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          openItem(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        window.ipcRenderer.invoke('hide-search');
        break;
    }
  }, [results, selectedIndex]);

  const openItem = (item: SearchResult) => {
    window.ipcRenderer.invoke('open-search-item', item.path);
  };

  const showContextMenu = (item: SearchResult) => {
    window.ipcRenderer.send('search-item-context-menu', { path: item.path, type: item.type });
  };

  // 获取文件类型的显示信息
  const getFileTypeInfo = (item: SearchResult) => {
    if (item.type === 'app') {
      return { color: 'text-blue-500', bg: 'bg-blue-50', label: '应用', icon: <AppWindow className="w-5 h-5" /> };
    }
    if (item.type === 'folder') {
      return { color: 'text-yellow-500', bg: 'bg-yellow-50', label: '文件夹', icon: <Folder className="w-5 h-5" /> };
    }
    const ext = item.path.split('.').pop()?.toLowerCase() || '';
    const info = fileTypeIcons[ext] || fileTypeIcons.default;
    return { ...info, icon: <File className={clsx("w-5 h-5", info.color)} /> };
  };

  // 格式化路径显示
  const formatPath = (path: string) => {
    if (homeDir && path.startsWith(homeDir)) {
      return '~' + path.slice(homeDir.length);
    }
    return path;
  };

  const fileResults = results.filter(item => item.type === 'file' || item.type === 'folder');
  const appResults = results.filter(item => item.type === 'app');

  return (
    <div className="h-screen w-screen bg-transparent flex flex-col overflow-hidden items-center pt-[15vh] px-4">
      {/* Search Box */}
      <div className="w-[720px] max-w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl shadow-[0_28px_72px_rgba(0,0,0,0.26)] overflow-hidden flex flex-col">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100/80 dark:border-zinc-800/50">
          <SearchIcon className="w-5 h-5 text-zinc-400/90" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索应用、文件或文件夹..."
            className="flex-1 bg-transparent appearance-none border-none outline-none focus:outline-none focus-visible:outline-none text-[17px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0 focus-ring-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            )}
            <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/80 rounded-md border border-zinc-200/80 dark:border-zinc-700/80">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        {results.length > 0 && (
          <div 
            ref={resultsContainerRef}
            className="max-h-[480px] overflow-y-auto py-2"
          >
            {/* 应用结果分组 */}
            {appResults.length > 0 && (
              <div className="mb-2">
                <div className="px-4 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  应用 ({appResults.length})
                </div>
                {appResults.map((item, index) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    isSelected={index === selectedIndex}
                    resultIndex={index}
                    onClick={() => openItem(item)}
                    onContextMenu={() => showContextMenu(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    getFileTypeInfo={getFileTypeInfo}
                    formatPath={formatPath}
                  />
                ))}
              </div>
            )}

            {/* 文件结果分组 */}
            {fileResults.length > 0 && (
              <div>
                {appResults.length > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800/50 my-1" />}
                <div className="px-4 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  文件 ({fileResults.length})
                </div>
                {fileResults.map((item, index) => {
                  const actualIndex = appResults.length + index;
                  return (
                    <SearchResultItem
                      key={item.id}
                      item={item}
                      isSelected={actualIndex === selectedIndex}
                      resultIndex={actualIndex}
                      onClick={() => openItem(item)}
                      onContextMenu={() => showContextMenu(item)}
                      onMouseEnter={() => setSelectedIndex(actualIndex)}
                      getFileTypeInfo={getFileTypeInfo}
                      formatPath={formatPath}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {query && !isLoading && results.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <SearchIcon className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500">未找到相关结果</p>
            <p className="text-xs text-zinc-400 mt-1">尝试使用不同的关键词</p>
          </div>
        )}

        {/* Footer - 只在有结果时显示，避免闪烁 */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              找到 {results.length} 个结果
              {appResults.length > 0 && fileResults.length > 0 && (
                <span className="ml-2">(应用 {appResults.length} · 文件 {fileResults.length})</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">↑↓</kbd>
                <span>选择</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">↵</kbd>
                <span>打开</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 搜索结果项组件
interface SearchResultItemProps {
  item: SearchResult;
  isSelected: boolean;
  resultIndex: number;
  onClick: () => void;
  onContextMenu: () => void;
  onMouseEnter: () => void;
  getFileTypeInfo: (item: SearchResult) => { color: string; bg: string; label: string; icon: React.ReactNode };
  formatPath: (path: string) => string;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  item,
  isSelected,
  resultIndex,
  onClick,
  onContextMenu,
  onMouseEnter,
  getFileTypeInfo,
  formatPath
}) => {
  const typeInfo = getFileTypeInfo(item);

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu();
      }}
      onMouseEnter={onMouseEnter}
      data-result-index={resultIndex}
      className={clsx(
        "px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-150 flex items-center gap-3",
        isSelected
          ? "bg-blue-500 shadow-md shadow-blue-500/20"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      )}
    >
      {/* Icon */}
      <div className={clsx(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        isSelected ? "bg-white/20" : typeInfo.bg
      )}>
        {item.icon ? (
          <img 
            src={item.icon} 
            alt="" 
            className="w-7 h-7 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className={isSelected ? 'text-white' : typeInfo.color}>
            {typeInfo.icon}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={clsx(
          "text-sm font-medium truncate",
          isSelected ? "text-white" : "text-zinc-900 dark:text-zinc-100"
        )}>
          {item.name}
        </h3>
        <p className={clsx(
          "text-xs truncate mt-0.5",
          isSelected ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
        )}>
          {item.preview || typeInfo.label}
        </p>
        <p className={clsx(
          "text-[10px] truncate mt-0.5",
          isSelected ? "text-blue-200/70" : "text-zinc-400 dark:text-zinc-500"
        )}>
          {formatPath(item.path)}
        </p>
      </div>

      {/* Type Badge */}
      <span className={clsx(
        "text-[10px] px-2 py-0.5 rounded-full shrink-0",
        isSelected 
          ? "bg-white/20 text-white" 
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
      )}>
        {typeInfo.label}
      </span>

      {/* Selected Indicator */}
      {isSelected && (
        <Command className="w-3.5 h-3.5 text-white/70 shrink-0" />
      )}
    </div>
  );
};

export default SearchPage;
