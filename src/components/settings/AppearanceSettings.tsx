import { useState, useEffect } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Monitor,
  Layout,
  AppWindow
} from 'lucide-react';
import clsx from 'clsx';

type Theme = 'light' | 'dark' | 'system';

interface AppearanceConfig {
  theme: Theme;
  fontFamily: string;
  themeColor: string;
  borderColor: string;
  maskColor: string;
  shadowColor: string;
  trayIcon: 'auto' | 'custom' | 'hidden';
  borderWidth: number;
  windowSize: { width: number; height: number };
  resizable: boolean;
  maximizable: boolean;
  fullscreenable: boolean;
}

export const AppearanceSettings = () => {
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [activeColorKey, setActiveColorKey] = useState<string | null>(null);
  const [tempColor, setTempColor] = useState('#228be6');
  
  const [config, setConfig] = useState<AppearanceConfig>({
    theme: 'system',
    fontFamily: 'Inter',
    themeColor: '#228be6',
    borderColor: '#228be6',
    maskColor: 'rgba(0, 0, 0, 0.5)',
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    trayIcon: 'auto',
    borderWidth: 3,
    windowSize: { width: 800, height: 600 },
    resizable: true,
    maximizable: true,
    fullscreenable: false,
  });

  useEffect(() => {
    window.ipcRenderer.invoke('get-appearance-config').then((savedConfig) => {
      setConfig(prev => ({ ...prev, ...savedConfig }));
      if (savedConfig.fontFamily) {
        document.documentElement.style.fontFamily = savedConfig.fontFamily;
      }
    });
  }, []);

  const changeTheme = (newTheme: Theme) => {
    const newConfig = { ...config, theme: newTheme };
    setConfig(newConfig);
    window.ipcRenderer.invoke('set-appearance-config', newConfig);
  };

  const updateConfig = (key: keyof AppearanceConfig, value: any) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };
      window.ipcRenderer.invoke('set-appearance-config', newConfig);

      if (key === 'fontFamily') {
        document.documentElement.style.fontFamily = value as string;
      }
      if (key === 'themeColor' || key === 'borderColor' || key === 'maskColor' || key === 'shadowColor') {
        const setVar = (name: string, val: string) => document.documentElement.style.setProperty(name, val);
        setVar('--theme-color', newConfig.themeColor);
        setVar('--border-color', newConfig.borderColor);
        setVar('--mask-color', newConfig.maskColor);
        setVar('--shadow-color', newConfig.shadowColor);
      }
      if (key === 'borderWidth') {
        document.documentElement.style.setProperty('--border-width', String(value));
      }
      if (key === 'trayIcon' && value === 'custom') {
        window.ipcRenderer.invoke('select-file').then((file: string | null) => {
          if (file) {
            updateConfig('trayIconPath' as any, file);
          }
        });
      }
      return newConfig;
    });
  };

  const openColorPicker = (key: string) => {
    setActiveColorKey(key);
    setTempColor(config[key as keyof AppearanceConfig] as string);
    setColorModalOpen(true);
  };

  const saveColor = () => {
    if (activeColorKey) {
      updateConfig(activeColorKey as keyof AppearanceConfig, tempColor);
    }
    setColorModalOpen(false);
  };

  const colorLabels: Record<string, string> = {
    themeColor: '主题颜色',
    borderColor: '锁定窗口颜色',
    maskColor: '截图时未选区域的颜色',
    shadowColor: '鼠标穿透时阴影',
  };

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '系统', icon: Monitor },
  ];

  return (
    <div className="min-h-full p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Palette size={24} className="text-blue-500" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">外观</h1>
        </div>

        <div className="space-y-6">
          {/* 主题模式 */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">主题模式</span>
              <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                {themeOptions.map((option, index) => {
                  const Icon = option.icon;
                  const isActive = config.theme === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => changeTheme(option.value as Theme)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                        index !== themeOptions.length - 1 && 'border-r border-zinc-200 dark:border-zinc-700'
                      )}
                    >
                      <Icon size={14} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 窗口管理 */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <AppWindow size={16} className="text-green-500" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">窗口管理</span>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 默认尺寸 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">默认尺寸</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.windowSize.width}
                    onChange={(e) => updateConfig('windowSize', { ...config.windowSize, width: parseInt(e.target.value) || 800 })}
                    className="w-16 px-2 py-1 text-xs text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100"
                  />
                  <span className="text-zinc-400">×</span>
                  <input
                    type="number"
                    value={config.windowSize.height}
                    onChange={(e) => updateConfig('windowSize', { ...config.windowSize, height: parseInt(e.target.value) || 600 })}
                    className="w-16 px-2 py-1 text-xs text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

              {/* 允许调整大小 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">允许调整大小</span>
                <button
                  onClick={() => updateConfig('resizable', !config.resizable)}
                  className={clsx(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    config.resizable ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                      config.resizable ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

              {/* 允许最大化 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">允许最大化</span>
                <button
                  onClick={() => updateConfig('maximizable', !config.maximizable)}
                  className={clsx(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    config.maximizable ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                      config.maximizable ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

              {/* 允许全屏 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">允许全屏</span>
                <button
                  onClick={() => updateConfig('fullscreenable', !config.fullscreenable)}
                  className={clsx(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    config.fullscreenable ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                      config.fullscreenable ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 颜色设置 */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-500 to-pink-500" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">颜色设置</span>
              </div>
            </div>
            
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {[
                { key: 'themeColor', label: '主题颜色' },
                { key: 'borderColor', label: '锁定窗口颜色' },
                { key: 'maskColor', label: '截图时未选区域的颜色' },
                { key: 'shadowColor', label: '鼠标穿透时阴影' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.label}</span>
                  <button
                    onClick={() => openColorPicker(item.key)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-sm border border-zinc-200 dark:border-zinc-700"
                      style={{ backgroundColor: config[item.key as keyof AppearanceConfig] as string }}
                    />
                    更改颜色
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 托盘图标 */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layout size={16} className="text-cyan-500" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">托盘图标</span>
              </div>
              <div className="flex items-center gap-4">
                {['auto', 'custom', 'hidden'].map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="trayIcon"
                      value={option}
                      checked={config.trayIcon === option}
                      onChange={(e) => updateConfig('trayIcon', e.target.value)}
                      className="w-4 h-4 text-blue-500 border-zinc-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {option === 'auto' ? '自动' : option === 'custom' ? '自定义' : '隐藏'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Color Picker Modal */}
      {colorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">
              {activeColorKey ? colorLabels[activeColorKey] : '选择颜色'}
            </h3>
            <div className="space-y-4">
              <input
                type="color"
                value={tempColor}
                onChange={(e) => setTempColor(e.target.value)}
                className="w-full h-32 rounded-lg cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">HEX</span>
                <input
                  type="text"
                  value={tempColor}
                  onChange={(e) => setTempColor(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 font-mono uppercase"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setColorModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveColor}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppearanceSettings;
