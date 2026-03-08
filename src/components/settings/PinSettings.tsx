import { useState, useEffect } from 'react';
import { Pin } from 'lucide-react';
import { ShortcutItem } from './ShortcutItem';

interface PinConfig {
  opacity: number;
}

export const PinSettings = () => {
  const [shortcut, setShortcut] = useState('');
  const [pinConfig, setPinConfig] = useState<PinConfig>({ opacity: 1 });

  useEffect(() => {
    window.ipcRenderer.invoke('get-shortcuts').then((config) => {
      setShortcut(config.pin);
    });
    window.ipcRenderer.invoke('get-pin-config').then((config) => {
      setPinConfig(config);
    });
  }, []);

  const handleShortcutChange = (value: string) => {
    setShortcut(value);
  };

  const saveShortcut = async (newValue: string) => {
    const success = await window.ipcRenderer.invoke('update-shortcut', 'pin', newValue);
    if (!success) {
      alert('快捷键保存失败，可能与系统快捷键冲突。');
    }
  };

  const handlePinOpacityChange = (opacity: number) => {
    setPinConfig((prev) => {
      const newConfig = { ...prev, opacity };
      window.ipcRenderer.invoke('set-pin-config', newConfig);
      return newConfig;
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3 tracking-tight">
        <Pin className="text-zinc-400 dark:text-zinc-400" /> 贴图设置
      </h2>

      <div className="space-y-8 w-full transition-colors duration-200">
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
            基本设置
          </h3>
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">默认透明度</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{Math.round(pinConfig.opacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.1" 
                value={pinConfig.opacity} 
                onChange={(e) => handlePinOpacityChange(parseFloat(e.target.value))}
                className="w-32"
              />
            </div>

            <ShortcutItem 
              label="贴图快捷键" 
              value={shortcut} 
              onChange={handleShortcutChange}
              onSave={saveShortcut}
              description="将剪切板中的图片贴在屏幕上"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
