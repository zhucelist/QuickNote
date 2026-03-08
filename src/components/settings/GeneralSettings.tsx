import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { ShortcutItem } from './ShortcutItem';

export const GeneralSettings = () => {
  const [shortcut, setShortcut] = useState('');
  const [historyLimit, setHistoryLimit] = useState<number>(50);
  const [startupSettings, setStartupSettings] = useState({ autoLaunch: false, silentStart: false });

  useEffect(() => {
    window.ipcRenderer.invoke('get-shortcuts').then((config) => {
      setShortcut(config.showClipboard);
    });
    window.ipcRenderer.invoke('get-history-limit').then((limit) => {
      setHistoryLimit(limit);
    });
    window.ipcRenderer.invoke('get-startup-settings').then((settings) => {
      setStartupSettings(settings);
    });
  }, []);

  const handleShortcutChange = (value: string) => {
    setShortcut(value);
  };

  const saveShortcut = async (newValue: string) => {
    const success = await window.ipcRenderer.invoke('update-shortcut', 'showClipboard', newValue);
    if (!success) {
      // ShortcutItem 组件已经处理了错误显示，这里可以不再弹窗，或者保留作为双重提示
      // alert('快捷键保存失败，可能与系统快捷键冲突。');
      throw new Error('快捷键保存失败'); // 抛出错误让 ShortcutItem 捕获
    }
  };

  const changeHistoryLimit = (limit: number) => {
    setHistoryLimit(limit);
    window.ipcRenderer.invoke('set-history-limit', limit);
  };

  const toggleAutoLaunch = async (enabled: boolean) => {
    await window.ipcRenderer.invoke('set-auto-launch', enabled);
    setStartupSettings(prev => ({ ...prev, autoLaunch: enabled }));
  };

  const toggleSilentStart = async (enabled: boolean) => {
    await window.ipcRenderer.invoke('set-silent-start', enabled);
    setStartupSettings(prev => ({ ...prev, silentStart: enabled }));
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3 tracking-tight">
        <SettingsIcon className="text-zinc-400 dark:text-zinc-400" /> 常规设置
      </h2>

      <div className="space-y-8 w-full transition-colors duration-200">
        {/* 启动设置 */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            启动设置
          </h3>
          <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50 divide-y divide-zinc-200 dark:divide-zinc-800/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">开机自启</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">跟随系统启动自动运行</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={startupSettings.autoLaunch} 
                  onChange={(e) => toggleAutoLaunch(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className={`flex items-center justify-between p-4 ${!startupSettings.autoLaunch ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">静默启动</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">启动时不显示主窗口，仅在托盘运行</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={startupSettings.silentStart} 
                  onChange={(e) => toggleSilentStart(e.target.checked)}
                  disabled={!startupSettings.autoLaunch}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 快捷键配置 */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            <SettingsIcon size={18} className="text-zinc-500" />
            全局快捷键
          </h3>
          
          <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50 divide-y divide-zinc-200 dark:divide-zinc-800/50">
            <ShortcutItem 
              label="打开剪切板" 
              value={shortcut} 
              onChange={handleShortcutChange}
              onSave={saveShortcut}
              description="呼出面板并显示历史记录"
            />
          </div>
        </div>

        {/* 历史记录设置 */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            历史记录
          </h3>
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">剪切板存储数量</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">超过限制的旧记录将被自动删除</span>
            </div>
            <select
              value={historyLimit}
              onChange={(e) => changeHistoryLimit(Number(e.target.value))}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
              <option value={200}>200 条</option>
              <option value={500}>500 条</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
