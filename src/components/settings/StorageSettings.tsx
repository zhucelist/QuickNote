import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

interface ScreenshotConfig {
  savePath: string;
  fileNameFormat?: string;
}

export const StorageSettings = () => {
  const [screenshotConfig, setScreenshotConfig] = useState<ScreenshotConfig>({ savePath: '' });
  const [historyLimit, setHistoryLimit] = useState<number>(50);

  useEffect(() => {
    // 获取历史记录限制
    window.ipcRenderer.invoke('get-history-limit').then((limit) => {
      setHistoryLimit(limit);
    });
    // 获取截图配置
    window.ipcRenderer.invoke('get-screenshot-config').then((config) => {
      setScreenshotConfig(config);
    });
  }, []);

  const handleFormatChange = (value: string) => {
    setScreenshotConfig(prev => {
        const newConfig = { ...prev, fileNameFormat: value };
        window.ipcRenderer.invoke('set-screenshot-config', newConfig);
        return newConfig;
    });
  };

  const handleSelectDirectory = async () => {
    const path = await window.ipcRenderer.invoke('select-directory');
    if (path) {
      setScreenshotConfig((prev) => {
        const newConfig = { ...prev, savePath: path };
        window.ipcRenderer.invoke('set-screenshot-config', newConfig);
        return newConfig;
      });
    }
  };

  const changeHistoryLimit = (limit: number) => {
    setHistoryLimit(limit);
    window.ipcRenderer.invoke('set-history-limit', limit);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3 tracking-tight">
        <Save className="text-zinc-400 dark:text-zinc-400" /> 保存设置
      </h2>

      <div className="space-y-8 w-full transition-colors duration-200">
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            文件存储
          </h3>
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">默认保存路径</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{screenshotConfig.savePath || '未设置'}</span>
              </div>
              <button
                onClick={handleSelectDirectory}
                className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
              >
                更改
              </button>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">文件名格式</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        支持变量: $yyyy$ (年), $MM$ (月), $dd$ (日), $HH$ (时), $mm$ (分), $ss$ (秒)
                    </span>
                </div>
                <input 
                    type="text" 
                    value={screenshotConfig.fileNameFormat || 'Screenshot_$yyyy-MM-dd_HH-mm-ss$.png'}
                    onChange={(e) => handleFormatChange(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
               
            </div>
          </div>
        </div>

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
