import React, { useState, useEffect } from 'react';
import { ClipboardList } from './components/ClipboardList';
import { GeneralSettings } from './components/settings/GeneralSettings';
import { AppearanceSettings } from './components/settings/AppearanceSettings';
import { ScreenshotSettings } from './components/settings/ScreenshotSettings';
import { PinSettings } from './components/settings/PinSettings';
import { AboutSettings } from './components/settings/AboutSettings';
import { ShortcutSettings } from './components/settings/ShortcutSettings';
import ScreenshotPage from './pages/ScreenshotEditor';
import { PinPage } from './pages/PinPage';
import SearchPage from './pages/Search';
import { 
  ClipboardList as ClipboardListIcon, 
  Settings as SettingsIcon, 
  Monitor,
  Pin, 
  Palette, 
  Info, 
  Search, 
  Keyboard,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { SearchSettings } from './components/settings/SearchSettings';

type Tab = 'clipboard' | 'settings' | 'appearance-settings' | 'screenshot-settings' | 'pin-settings' | 'about-settings' | 'search-settings' | 'shortcut-settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('clipboard');
  const [isScreenshotMode, setIsScreenshotMode] = useState(() => window.location.hash === '#screenshot');
  const [isPinMode, setIsPinMode] = useState(() => window.location.hash === '#pin');
  const [isSearchMode, setIsSearchMode] = useState(() => window.location.hash === '#search');
  const [/*isRecorderMode*/, setIsRecorderMode] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
        if (window.location.hash === '#screenshot') {
            setIsScreenshotMode(true);
            setIsPinMode(false);
            setIsSearchMode(false);
            setIsRecorderMode(false);
        } else if (window.location.hash === '#pin') {
            setIsPinMode(true);
            setIsScreenshotMode(false);
            setIsSearchMode(false);
            setIsRecorderMode(false);
        } else if (window.location.hash === '#search') {
            setIsSearchMode(true);
            setIsScreenshotMode(false);
            setIsPinMode(false);
            setIsRecorderMode(false);
        } else {
            setIsScreenshotMode(false);
            setIsPinMode(false);
            setIsSearchMode(false);
            setIsRecorderMode(false);
        }
    };

    window.addEventListener('hashchange', handleHashChange);

    const handleSwitchTab = (_event: unknown, tab: Tab) => {
      setActiveTab(tab);
    };

    window.ipcRenderer.on('switch-tab', handleSwitchTab);

    window.ipcRenderer.invoke('get-appearance-config').then((config) => {
      if (config && config.fontFamily) {
        document.documentElement.style.fontFamily = config.fontFamily;
      }
      if (config) {
        const setVar = (name: string, val?: string) => {
          if (!val) return;
          document.documentElement.style.setProperty(name, val);
        };
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
        setVar('--theme-color', config.themeColor);
        setVar('--border-color', config.borderColor);
        setVar('--mask-color', hex8ToRgba(config.maskColor));
        setVar('--shadow-color', hex8ToRgba(config.shadowColor));
        document.documentElement.style.setProperty('--border-width', String(config.borderWidth ?? 2));
        if (config.anchorType) {
          document.documentElement.style.setProperty('--anchor-type', String(config.anchorType));
        }
      }
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.ipcRenderer.off('switch-tab', handleSwitchTab);
    };
  }, []);

  if (isScreenshotMode) {
    return <ScreenshotPage />;
  }

  if (isPinMode) {
    return <PinPage />;
  }

  if (isSearchMode) {
    return <SearchPage />;
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 w-full h-full text-zinc-900 dark:text-zinc-100 flex font-sans antialiased transition-colors duration-200 overflow-hidden">
      {/* 侧边栏 - 美化版 */}
      <div className="w-[72px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col items-center py-5 gap-1 shrink-0 transition-colors duration-200">
        {/* Logo */}
        <div className="mb-4 p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
          <Sparkles size={20} className="text-white" />
        </div>
        
        <div className="w-10 h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-700 to-transparent my-2" />
        
        {/* 主要功能 */}
        <SidebarButton 
          active={activeTab === 'clipboard'} 
          onClick={() => setActiveTab('clipboard')} 
          icon={<ClipboardListIcon size={18} />}
          title="剪切板历史"
          variant="primary"
        />
        
        <div className="w-10 h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-700 to-transparent my-2" />
        
        {/* 设置分组 */}
        <div className="flex flex-col gap-1">
          <SidebarButton 
            active={activeTab === 'appearance-settings'} 
            onClick={() => setActiveTab('appearance-settings')} 
            icon={<Palette size={18} />}
            title="外观"
          />
          <SidebarButton 
            active={activeTab === 'screenshot-settings'} 
            onClick={() => setActiveTab('screenshot-settings')} 
            icon={<Monitor size={18} />}
            title="截图设置"
          />
          <SidebarButton 
            active={activeTab === 'pin-settings'} 
            onClick={() => setActiveTab('pin-settings')} 
            icon={<Pin size={18} />}
            title="贴图设置"
          />
          <SidebarButton 
            active={activeTab === 'search-settings'} 
            onClick={() => setActiveTab('search-settings')} 
            icon={<Search size={18} />}
            title="搜索设置"
          />
        </div>

        <div className="flex-1" />
        
        {/* 底部设置 */}
        <div className="flex flex-col gap-1 mb-2">
          <SidebarButton 
            active={activeTab === 'shortcut-settings'} 
            onClick={() => setActiveTab('shortcut-settings')} 
            icon={<Keyboard size={18} />}
            title="快捷键"
          />
          <SidebarButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={<SettingsIcon size={18} />}
            title="常规设置"
          />
          <SidebarButton 
            active={activeTab === 'about-settings'} 
            onClick={() => setActiveTab('about-settings')} 
            icon={<Info size={18} />}
            title="关于"
          />
        </div>
      </div>

      {/* 主要内容区域 - 美化版 */}
      <div className="flex-1 overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 relative transition-colors duration-200">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        
        {/* 内容 */}
        <div className={clsx("relative h-full", activeTab === 'clipboard' ? "overflow-hidden" : "overflow-auto")}>
          <div className={clsx("animate-fade-in", activeTab === 'clipboard' && "h-full")}>
            {activeTab === 'clipboard' && <ClipboardList />}
            {activeTab === 'appearance-settings' && <AppearanceSettings />}
            {activeTab === 'settings' && <GeneralSettings />}
            {activeTab === 'screenshot-settings' && <ScreenshotSettings />}
            {activeTab === 'pin-settings' && <PinSettings />}
            {activeTab === 'search-settings' && <SearchSettings />}
            {activeTab === 'shortcut-settings' && <ShortcutSettings />}
            {activeTab === 'about-settings' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  variant?: 'default' | 'primary';
}

const SidebarButton = ({ active, onClick, icon, title, variant = 'default' }: SidebarButtonProps) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative group",
      variant === 'primary' && active
        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
        : active
        ? "bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-md"
        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50"
    )}
    title={title}
  >
    {icon}
    
    {/* 活跃指示器 */}
    {active && variant !== 'primary' && (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
    )}
  </button>
);

export default App;
