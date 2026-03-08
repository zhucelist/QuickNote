import { useState, useEffect } from 'react';
import { Monitor, MousePointer2 } from 'lucide-react';
import { ShortcutItem } from './ShortcutItem';

export const ScreenshotSettings = () => {
  const [shortcut, setShortcut] = useState('');
  const [savePath, setSavePath] = useState('');
  const [fileNameFormat, setFileNameFormat] = useState<string>('Screenshot_$yyyy-MM-dd_HH-mm-ss$.png');
  const [appearance, setAppearance] = useState<any>(null);
  const [borderWidth, setBorderWidth] = useState<number>(2);
  const [anchorType, setAnchorType] = useState<'all'|'corner'|'none'>('all');
  const [borderColor, setBorderColor] = useState<string>('#3b82f6');

  useEffect(() => {
    window.ipcRenderer.invoke('get-shortcuts').then((config) => {
      setShortcut(config.screenshot);
    });
    window.ipcRenderer.invoke('get-screenshot-config').then((config) => {
      if (config) {
        setSavePath(config.savePath || '');
        setFileNameFormat(config.fileNameFormat || 'Screenshot_$yyyy-MM-dd_HH-mm-ss$.png');
      }
    });
    window.ipcRenderer.invoke('get-appearance-config').then((cfg) => {
      if (cfg) {
        setAppearance(cfg);
        setBorderWidth(cfg.borderWidth ?? 2);
        setAnchorType(cfg.anchorType ?? 'all');
        setBorderColor(cfg.borderColor ?? '#3b82f6');
      }
    });
  }, []);

  const handleShortcutChange = (value: string) => {
    setShortcut(value);
  };

  const saveShortcut = async (newValue: string) => {
    const success = await window.ipcRenderer.invoke('update-shortcut', 'screenshot', newValue);
    if (!success) {
      alert('快捷键保存失败，可能与系统快捷键冲突。');
    }
  };

  const handleSelectDirectory = async () => {
    const path = await window.ipcRenderer.invoke('select-directory');
    if (path) {
      setSavePath(path);
      window.ipcRenderer.invoke('set-screenshot-config', { savePath: path, fileNameFormat });
    }
  };

  const handleFormatChange = (value: string) => {
    setFileNameFormat(value);
    window.ipcRenderer.invoke('set-screenshot-config', { savePath, fileNameFormat: value });
  };

  const applyCss = (key: string, value: string | number) => {
    if (key === 'borderColor') document.documentElement.style.setProperty('--border-color', String(value));
    if (key === 'borderWidth') document.documentElement.style.setProperty('--border-width', String(value));
    if (key === 'anchorType') document.documentElement.style.setProperty('--anchor-type', String(value));
  };

  const updateAppearance = (partial: any) => {
    if (!appearance) return;
    const newCfg = { ...appearance, ...partial };
    setAppearance(newCfg);
    window.ipcRenderer.invoke('set-appearance-config', newCfg);
  };
  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3 tracking-tight">
        <Monitor className="text-zinc-400 dark:text-zinc-400" /> 截图设置
      </h2>

      <div className="space-y-8 w-full transition-colors duration-200">
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">快捷键</h3>
          <div className="flex flex-col gap-4">
            <ShortcutItem
              label="截图快捷键"
              value={shortcut}
              onChange={handleShortcutChange}
              onSave={saveShortcut}
              description="快速截取屏幕区域"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">文件存储</h3>
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">默认保存路径</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{savePath || '未设置'}</span>
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
                value={fileNameFormat}
                onChange={(e) => handleFormatChange(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            <MousePointer2 size={16} className="text-zinc-400" />
            截图外观
          </h3>
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">选区边框宽度</span>
              <input
                type="number"
                min={1}
                max={10}
                value={borderWidth}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setBorderWidth(v);
                  applyCss('borderWidth', v);
                  updateAppearance({ borderWidth: v });
                }}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm outline-none w-20 text-center"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">锚点显示</span>
              <select
                value={anchorType}
                onChange={(e) => {
                  const v = e.target.value as 'all'|'corner'|'none';
                  setAnchorType(v);
                  applyCss('anchorType', v);
                  updateAppearance({ anchorType: v });
                }}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm outline-none w-48"
              >
                <option value="all">显示八个方向</option>
                <option value="corner">仅显示四角</option>
                <option value="none">不显示</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">选区边框颜色</span>
              <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 transition-colors shadow-sm relative">
                <div className="w-4 h-4 rounded border border-zinc-200 dark:border-zinc-600 shadow-sm" style={{ backgroundColor: borderColor }} />
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">更改颜色</span>
                <input
                  type="color"
                  value={borderColor.slice(0,7)}
                  onChange={(e) => {
                    const c = e.target.value;
                    setBorderColor(c);
                    applyCss('borderColor', c);
                    updateAppearance({ borderColor: c });
                  }}
                  className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
