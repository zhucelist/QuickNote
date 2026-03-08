import { useState, useEffect } from 'react';
import { Info, Github, ExternalLink, RefreshCw, Mail } from 'lucide-react';
import { version } from '../../../package.json';

export const AboutSettings = () => {
  const [appVersion, setAppVersion] = useState(version);
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  useEffect(() => {
    window.ipcRenderer.invoke('get-app-version').then(ver => {
      if (ver) setAppVersion(ver);
    });

    const handleUpdateMessage = (_: any, message: string) => {
        setUpdateStatus(message);
        setChecking(false);
    };

    window.ipcRenderer.on('update-message', handleUpdateMessage);
    return () => {
        window.ipcRenderer.off('update-message', handleUpdateMessage);
    };
  }, []);

  const handleCheckUpdate = () => {
    setChecking(true);
    setUpdateStatus('正在检查更新...');
    window.ipcRenderer.invoke('check-for-update');
  };

  const openLink = (url: string) => {
    window.ipcRenderer.invoke('open-external', url);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-200 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3 tracking-tight">
        <Info className="text-zinc-400 dark:text-zinc-400" /> 关于
      </h2>

      <div className="space-y-8 w-full transition-colors duration-200 max-w-2xl">
        {/* App Info */}
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 shadow-sm dark:shadow-none">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-6 flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">QuickNote</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">版本 v{appVersion}</p>
          
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all
              ${checking 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-95'
              }
            `}
          >
            <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
            {checking ? '检查中...' : '检查更新'}
          </button>
          
          {updateStatus && (
             <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 animate-fade-in">
                 {updateStatus}
             </p>
          )}
        </div>

        {/* Links */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 overflow-hidden shadow-sm dark:shadow-none">
            <LinkItem 
                icon={<Github size={20} />} 
                label="GitHub 仓库" 
                desc="查看源码与贡献代码"
                onClick={() => openLink('https://github.com/zhucelist/QuickNote')}
            />
            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
            <LinkItem 
                icon={<Mail size={20} />} 
                label="反馈问题" 
                desc="提交 Bug 或功能建议"
                onClick={() => openLink('mailto:zhucelist@163.com')}
            />
            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
            <LinkItem 
                icon={<ExternalLink size={20} />} 
                label="官方网站" 
                desc="访问官网获取更多信息"
                onClick={() => openLink('https://github.com/zhucelist/QuickNote')}
            />
        </div>

        <div className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-8">
            <p>Copyright © {new Date().getFullYear()} QuickNote Team. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

const LinkItem = ({ icon, label, desc, onClick }: { icon: React.ReactNode, label: string, desc: string, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group text-left"
    >
        <div className="flex items-center gap-4">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">{desc}</p>
            </div>
        </div>
        <ExternalLink size={16} className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400 transition-colors" />
    </button>
);
