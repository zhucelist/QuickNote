import { useState, useEffect } from 'react';
import { ClipboardList } from './components/ClipboardList';
import { GeneralSettings } from './components/settings/GeneralSettings';
import { AppearanceSettings } from './components/settings/AppearanceSettings';
import { ScreenshotSettings } from './components/settings/ScreenshotSettings';
import { PinSettings } from './components/settings/PinSettings';
import { AboutSettings } from './components/settings/AboutSettings';
import { ScreenshotPage } from './pages/Screenshot';
import { PinPage } from './pages/PinPage';
import { ClipboardList as ClipboardListIcon, Settings as SettingsIcon, Monitor, Pin, Palette, Info } from 'lucide-react';
import clsx from 'clsx';

type Tab = 'clipboard' | 'settings' | 'appearance-settings' | 'screenshot-settings' | 'pin-settings' | 'about-settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('clipboard');
  // Initialize state based on hash immediately to prevent flash of main UI
  const [isScreenshotMode, setIsScreenshotMode] = useState(() => window.location.hash === '#screenshot');
  const [isPinMode, setIsPinMode] = useState(() => window.location.hash === '#pin');
  const [/*isRecorderMode*/, setIsRecorderMode] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
        if (window.location.hash === '#screenshot') {
            setIsScreenshotMode(true);
            setIsPinMode(false);
            setIsRecorderMode(false);
        } else if (window.location.hash === '#pin') {
            setIsPinMode(true);
            setIsScreenshotMode(false);
            setIsRecorderMode(false);
        } else {
            setIsScreenshotMode(false);
            setIsPinMode(false);
            setIsRecorderMode(false);
        }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial check handled by state initializer

    const handleSwitchTab = (_event: unknown, tab: Tab) => {
      setActiveTab(tab);
    };

    window.ipcRenderer.on('switch-tab', handleSwitchTab);

    // Apply saved appearance settings
    window.ipcRenderer.invoke('get-appearance-config').then((config) => {
      if (config && config.fontFamily) {
        document.documentElement.style.fontFamily = config.fontFamily;
      }
      // Apply color variables
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
        // width & anchor
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

  // 录屏页面已移除

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 w-full h-full text-zinc-900 dark:text-zinc-100 flex font-sans antialiased transition-colors duration-200 overflow-hidden">
      {/* 侧边栏 */}
      <div className="w-[60px] bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-6 gap-2 shrink-0 transition-colors duration-200">
        <SidebarButton 
          active={activeTab === 'clipboard'} 
          onClick={() => setActiveTab('clipboard')} 
          icon={<ClipboardListIcon size={20} />}
          title="剪切板历史"
        />
        
        <div className="w-8 h-px bg-zinc-100 dark:bg-zinc-800 my-2" />
        
        <SidebarButton 
          active={activeTab === 'appearance-settings'} 
          onClick={() => setActiveTab('appearance-settings')} 
          icon={<Palette size={20} />}
          title="外观"
        />

        <SidebarButton 
          active={activeTab === 'screenshot-settings'} 
          onClick={() => setActiveTab('screenshot-settings')} 
          icon={<Monitor size={20} />}
          title="截图设置"
        />
        <SidebarButton 
          active={activeTab === 'pin-settings'} 
          onClick={() => setActiveTab('pin-settings')} 
          icon={<Pin size={20} />}
          title="贴图设置"
        />
        {/* 录屏设置已移除 */}
        {/* 保存设置入口已合并到截图设置 */}

        <div className="flex-1" />
        
        <SidebarButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<SettingsIcon size={20} />}
          title="常规设置"
        />
        
        <SidebarButton 
          active={activeTab === 'about-settings'} 
          onClick={() => setActiveTab('about-settings')} 
          icon={<Info size={20} />}
          title="关于"
        />
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950 relative transition-colors duration-200">
        {activeTab === 'clipboard' && <ClipboardList />}
        {activeTab === 'appearance-settings' && <AppearanceSettings />}
        {activeTab === 'settings' && <GeneralSettings />}
        {activeTab === 'screenshot-settings' && <ScreenshotSettings />}
        {activeTab === 'pin-settings' && <PinSettings />}
        {activeTab === 'about-settings' && <AboutSettings />}
        {/* 录屏设置已移除 */}
        {/* 保存设置入口已合并到截图设置 */}
      </div>
    </div>
  );
}

const SidebarButton = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-10 h-10 rounded-md flex items-center justify-center transition-all duration-200",
      active 
        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-white/10" 
        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
    )}
    title={title}
  >
    {icon}
  </button>
);

export default App;
