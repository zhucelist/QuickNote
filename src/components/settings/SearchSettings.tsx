import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { ShortcutItem } from './ShortcutItem';

interface SearchConfig {
  searchShortcut: string;
}

export const SearchSettings = () => {
  const [config, setConfig] = useState<SearchConfig>({
    searchShortcut: 'Ctrl+Q',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取当前快捷键配置
    window.ipcRenderer.invoke('get-shortcuts').then((shortcuts) => {
      console.log('[SearchSettings] Got shortcuts:', shortcuts);
      if (shortcuts && shortcuts.search) {
        setConfig(prev => ({ ...prev, searchShortcut: shortcuts.search }));
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[SearchSettings] Failed to get shortcuts:', err);
      setLoading(false);
    });
  }, []);

  const handleShortcutChange = (value: string) => {
    console.log('[SearchSettings] Shortcut changed to:', value);
    // key 这里应该是 'search'，对应 shortcuts 配置里的 key
    window.ipcRenderer.invoke('update-shortcut', 'search', value).then((success) => {
      console.log('[SearchSettings] Update shortcut result:', success);
      if (success) {
        setConfig(prev => ({ ...prev, searchShortcut: value }));
      } else {
        // 如果更新失败（如冲突），可以给个提示，这里暂时不做 UI 反馈，因为 ShortcutItem 可能已经处理了显示
        // 重新获取一次以回滚 UI
        window.ipcRenderer.invoke('get-shortcuts').then((shortcuts) => {
            if (shortcuts && shortcuts.search) {
              setConfig(prev => ({ ...prev, searchShortcut: shortcuts.search }));
            }
        });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-3">
          <Search className="text-zinc-400 w-5 h-5 sm:w-6 sm:h-6" /> 
          <span>搜索设置</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          配置全局搜索功能的快捷键和行为
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 lg:space-y-8 w-full">
        {/* 快捷键设置 */}
        <section className="space-y-3 lg:space-y-4">
          <h3 className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            快捷键
          </h3>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <ShortcutItem
              label="唤醒搜索框"
              value={config.searchShortcut}
              onChange={handleShortcutChange}
              description="快速打开或关闭全局搜索框"
            />
          </div>
        </section>

        {/* 功能说明 */}
        <section className="space-y-3 lg:space-y-4">
          <h3 className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            功能说明
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 sm:p-5 rounded-xl border border-blue-100 dark:border-blue-800">
            <p className="mb-3 font-semibold text-blue-900 dark:text-blue-100 text-sm sm:text-base">
              如何使用：
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>按下快捷键（默认 Ctrl+Q）唤起搜索框。</li>
              <li>输入应用名称或文件名进行搜索。</li>
              <li>使用 ↑ ↓ 键选择结果，Enter 键打开。</li>
              <li>再次按下快捷键或 Esc 键关闭搜索框。</li>
            </ul>
          </div>
        </section>

        {/* 提示信息 */}
        <section className="space-y-3 lg:space-y-4">
          <h3 className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            提示
          </h3>
          <div className="bg-zinc-100 dark:bg-zinc-800/50 p-4 sm:p-5 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              如果快捷键与其他应用程序冲突，请尝试使用不同的组合键。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
