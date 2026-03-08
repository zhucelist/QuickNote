import { useState, useEffect } from 'react';
import { Palette, Sun, Moon, Monitor, Layout } from 'lucide-react';
import clsx from 'clsx';

type Theme = 'light' | 'dark' | 'system';
type AnchorType = 'all' | 'corner' | 'none';

interface AppearanceConfig {
  theme: Theme;
  fontFamily: string;
  themeColor: string;
  borderColor: string;
  maskColor: string;
  shadowColor: string;
  trayIcon: 'auto' | 'style1' | 'custom' | 'hidden';
  borderWidth: number;
  anchorType: AnchorType;
  windowSize: { width: number; height: number };
  resizable: boolean;
  maximizable: boolean;
  fullscreenable: boolean;
}

export const AppearanceSettings = () => {
  const [config, setConfig] = useState<AppearanceConfig>({
    theme: 'system',
    fontFamily: 'Helvetica Neue',
    themeColor: '#3b82f6',
    borderColor: '#3b82f6',
    maskColor: '#00000080',
    shadowColor: '#00000040',
    trayIcon: 'auto',
    borderWidth: 3,
    anchorType: 'all',
    windowSize: { width: 800, height: 600 },
    resizable: true,
    maximizable: true,
    fullscreenable: false,
  });

  useEffect(() => {
    window.ipcRenderer.invoke('get-appearance-config').then((savedConfig) => {
      setConfig(prev => ({ ...prev, ...savedConfig }));
      // Apply initial font
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
        
        // Apply font change immediately
        if (key === 'fontFamily') {
             document.documentElement.style.fontFamily = value as string;
        }
        // Apply color variables immediately
        if (key === 'themeColor' || key === 'borderColor' || key === 'maskColor' || key === 'shadowColor') {
            const setVar = (name: string, val: string) => document.documentElement.style.setProperty(name, val);
            const hex8ToRgba = (hex: string) => {
              if (!hex || !hex.startsWith('#')) return hex;
              if (hex.length === 9) {
                const r = parseInt(hex.slice(1,3),16);
                const g = parseInt(hex.slice(3,5),16);
                const b = parseInt(hex.slice(5,7),16);
                const a = parseInt(hex.slice(7,9),16)/255;
                return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
              }
              return hex;
            };
            if (key === 'themeColor') setVar('--theme-color', value as string);
            if (key === 'borderColor') setVar('--border-color', value as string);
            if (key === 'maskColor') setVar('--mask-color', hex8ToRgba(value as string));
            if (key === 'shadowColor') setVar('--shadow-color', hex8ToRgba(value as string));
        }
        // Apply border width and anchor type immediately
        if (key === 'borderWidth') {
            document.documentElement.style.setProperty('--border-width', String(value));
        }
        if (key === 'anchorType') {
            document.documentElement.style.setProperty('--anchor-type', String(value));
        }
        // Tray icon custom path prompt
        if (key === 'trayIcon' && value === 'custom') {
            // If no custom path, prompt select file
            if (!(newConfig as any).trayIconPath) {
                window.ipcRenderer.invoke('select-file').then((file: string | null) => {
                    if (file) {
                        updateConfig('trayIconPath' as any, file);
                    }
                });
            }
        }
        if (key === 'windowSize') {
             window.ipcRenderer.send('resize-window', value);
        }
        return newConfig;
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3 tracking-tight">
        <Palette className="text-zinc-400 dark:text-zinc-400" /> 外观
      </h2>

      <div className="space-y-8 w-full transition-colors duration-200">
        {/* 主题设置 */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 p-6 shadow-sm dark:shadow-none">
          <div className="flex flex-col gap-6">
            {/* 主题模式 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">主题模式</span>
              <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-64">
                <ThemeOption 
                  active={config.theme === 'light'} 
                  onClick={() => changeTheme('light')} 
                  icon={<Sun size={14} />} 
                  label="浅色" 
                />
                <ThemeOption 
                  active={config.theme === 'dark'} 
                  onClick={() => changeTheme('dark')} 
                  icon={<Moon size={14} />} 
                  label="深色" 
                />
                <ThemeOption 
                  active={config.theme === 'system'} 
                  onClick={() => changeTheme('system')} 
                  icon={<Monitor size={14} />} 
                  label="系统" 
                />
              </div>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
            
            {/* 窗口管理 */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2">
                <Monitor size={16} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">窗口管理</span>
              </div>
              
              <div className="bg-white dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50 p-4 space-y-4">
                {/* 窗口尺寸 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">默认尺寸</span>
                  <div className="flex items-center gap-2">
                      <input 
                          type="number" 
                          value={config.windowSize?.width || 800} 
                          onChange={(e) => updateConfig('windowSize', { ...config.windowSize, width: parseInt(e.target.value) })}
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm outline-none w-20 text-center focus:ring-1 focus:ring-blue-500 transition-shadow"
                          placeholder="宽"
                      />
                      <span className="text-zinc-400">×</span>
                      <input 
                          type="number" 
                          value={config.windowSize?.height || 600} 
                          onChange={(e) => updateConfig('windowSize', { ...config.windowSize, height: parseInt(e.target.value) })}
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm outline-none w-20 text-center focus:ring-1 focus:ring-blue-500 transition-shadow"
                          placeholder="高"
                      />
                  </div>
                </div>

                <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                {/* 窗口行为开关 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">允许调整大小</span>
                      <Switch 
                        checked={config.resizable} 
                        onChange={(checked: boolean) => updateConfig('resizable', checked)} 
                      />
                  </div>
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">允许最大化</span>
                      <Switch 
                        checked={config.maximizable} 
                        onChange={(checked: boolean) => updateConfig('maximizable', checked)} 
                      />
                  </div>
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">允许全屏</span>
                      <Switch 
                        checked={config.fullscreenable} 
                        onChange={(checked: boolean) => updateConfig('fullscreenable', checked)} 
                      />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

          
            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* 颜色设置组 */}
            <ColorItem 
                label="主题颜色" 
                color={config.themeColor} 
                onChange={(c) => updateConfig('themeColor', c)} 
            />
            <ColorItem 
                label="锁定窗口颜色" 
                color={config.borderColor} 
                onChange={(c) => updateConfig('borderColor', c)} 
            />
            <ColorItem 
                label="截图时未选区域的颜色" 
                color={config.maskColor} 
                onChange={(c) => updateConfig('maskColor', c)} 
            />
            <ColorItem 
                label="鼠标穿透时阴影" 
                color={config.shadowColor} 
                onChange={(c) => updateConfig('shadowColor', c)} 
            />

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* 托盘图标 */}
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Layout size={16} className="text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">托盘图标</span>
               </div>
               <div className="flex items-center gap-4">
                  <RadioOption 
                    label="自动" 
                    checked={config.trayIcon === 'auto'} 
                    onChange={() => updateConfig('trayIcon', 'auto')} 
                  />
                  <RadioOption 
                    label="自定义" 
                    checked={config.trayIcon === 'custom'} 
                    onChange={() => updateConfig('trayIcon', 'custom')} 
                  />
                  <RadioOption 
                    label="隐藏" 
                    checked={config.trayIcon === 'hidden'} 
                    onChange={() => updateConfig('trayIcon', 'hidden')} 
                  />
               </div>
            </div>
          </div>
        </div>

        {/* 截图外观设置已移动至截图设置页面 */}
      </div>
    </div>
  );
};

const ThemeOption = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
      active 
        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10" 
        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const ColorItem = ({ label, color, onChange }: { label: string; color: string; onChange: (c: string) => void }) => (
    <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
        <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors shadow-sm relative">
            <div 
                className="w-4 h-4 rounded border border-zinc-200 dark:border-zinc-600 shadow-sm"
                style={{ backgroundColor: color }}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">更改颜色</span>
            <input 
                type="color" 
                value={color.slice(0, 7)} 
                onChange={(e) => onChange(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full" 
            />
        </label>
    </div>
);

const Switch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={clsx(
      "w-11 h-6 rounded-full transition-colors relative",
      checked ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-700"
    )}
  >
    <div className={clsx(
      "w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform",
      checked ? "left-[22px]" : "left-0.5"
    )} />
  </button>
);

const RadioOption = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
    <label className="flex items-center gap-2 cursor-pointer">
        <div className={clsx(
            "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
            checked ? "border-blue-500 bg-blue-500" : "border-zinc-300 dark:border-zinc-600"
        )}>
            {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
        </div>
        <input type="radio" className="hidden" checked={checked} onChange={onChange} />
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
    </label>
);
