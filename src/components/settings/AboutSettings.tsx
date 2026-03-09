import { useState, useEffect } from 'react';
import { Github, ExternalLink, RefreshCw, Mail, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { version } from '../../../package.json';
import clsx from 'clsx';

export const AboutSettings = () => {
  const [appVersion, setAppVersion] = useState(version);
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    // 获取应用版本
    window.ipcRenderer.invoke('get-app-version').then(ver => {
      if (ver) setAppVersion(ver);
    });

    const handleUpdateMessage = (_: any, message: string) => {
        setUpdateStatus(message);
        
        // 解析下载进度
        if (message.includes('下载中...')) {
          const match = message.match(/(\d+)%/);
          if (match) {
            setDownloadProgress(parseInt(match[1]));
          }
        } else if (message.includes('下载完成')) {
          setDownloadProgress(100);
          setChecking(false);
        } else if (message.includes('出错') || message.includes('最新')) {
          setChecking(false);
          setDownloadProgress(null);
        }
    };

    window.ipcRenderer.on('update-message', handleUpdateMessage);
    return () => {
        window.ipcRenderer.off('update-message', handleUpdateMessage);
    };
  }, []);

  const handleCheckUpdate = () => {
    setChecking(true);
    setUpdateStatus('正在检查更新...');
    setDownloadProgress(null);
    window.ipcRenderer.invoke('check-for-update');
  };

  const openLink = (url: string) => {
    window.ipcRenderer.invoke('open-external', url);
  };

  return (
    <div className="flex flex-col items-center justify-start h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 transition-colors duration-300 overflow-y-auto">
      
      {/* 顶部 Hero 区域 */}
      <div className="flex flex-col items-center mt-12 mb-16 transition-all duration-700 ease-out translate-y-0 opacity-100">
        <div className="relative group">
          {/* 装饰性背景光晕 */}
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-300"></div>
          
          {/* 图标容器 */}
          <div className="relative w-28 h-28 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex items-center justify-center border border-zinc-200/50 dark:border-zinc-800 transition-transform duration-500 group-hover:scale-105">
            <svg className="w-14 h-14 text-blue-600 dark:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
        </div>
        
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">快截笔记</h1>
        <div className="mt-3 flex items-center gap-2">
          <span className="px-3 py-0.5 text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full border border-zinc-300 dark:border-zinc-700">
            v{appVersion}
          </span>
        </div>
      </div>

      {/* 更新操作区域 */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4 mb-16">
        {downloadProgress !== null ? (
           <div className="w-full bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
             <div className="flex justify-between items-center mb-2 text-sm">
               <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                 {downloadProgress === 100 ? <CheckCircle2 className="w-4 h-4 text-emerald-500"/> : <Download className="w-4 h-4 text-blue-500 animate-bounce"/>}
                 {downloadProgress === 100 ? '下载完成' : '下载更新中...'}
               </span>
               <span className="font-mono text-xs text-zinc-500">{downloadProgress}%</span>
             </div>
             <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
               <div 
                 className={clsx(
                   "h-full rounded-full transition-all duration-500 ease-out",
                   downloadProgress === 100 ? "bg-emerald-500" : "bg-blue-500"
                 )}
                 style={{ width: `${downloadProgress}%` }}
               />
             </div>
             {downloadProgress === 100 && (
                <p className="mt-2 text-xs text-zinc-500 text-center">应用将自动重启以完成安装</p>
             )}
           </div>
        ) : (
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className={`
              relative w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300
              flex items-center justify-center gap-2 overflow-hidden group border
              ${checking 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border-zinc-200 dark:border-zinc-700' 
                : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent hover:shadow-xl active:scale-95'
              }
            `}
          >
            <RefreshCw size={16} className={`${checking ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            {checking ? '正在检查...' : '检查更新'}
          </button>
        )}
        
        {updateStatus && downloadProgress === null && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 transition-opacity duration-300 flex items-center gap-1.5">
            {updateStatus.includes('出错') && <AlertCircle size={14} className="text-red-500"/>}
            {updateStatus}
          </p>
        )}
      </div>

      {/* 链接列表区域 */}
      <div className="w-full max-w-md grid grid-cols-1 gap-3">
        <LinkButton 
          icon={<Github size={18} />} 
          title="GitHub 仓库" 
          description="查看源码、提交 Issue 或贡献代码"
          onClick={() => openLink('https://github.com/zhucelist/QuickNote')}
        />
        <LinkButton 
          icon={<Mail size={18} />} 
          title="反馈问题" 
          description="发送邮件反馈 Bug 或功能建议"
          onClick={() => openLink('mailto:zhucelist@163.com')}
        />
        <LinkButton 
          icon={<ExternalLink size={18} />} 
          title="官方网站" 
          description="访问官网了解更多功能与动态"
          onClick={() => openLink('https://github.com/zhucelist/QuickNote')}
        />
      </div>

      {/* 底部页脚 */}
      <div className="mt-auto pt-12 flex flex-col items-center gap-2">
      </div>
    </div>
  );
};

// 链接按钮组件
const LinkButton = ({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200/60 dark:hover:border-zinc-800 transition-all duration-300 group hover:shadow-md"
  >
    <div className="flex items-center gap-4">
      <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors">
        {icon}
      </div>
      <div className="text-left">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">{description}</p>
      </div>
    </div>
    <ExternalLink size={14} className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-400 dark:group-hover:text-zinc-500 transition-colors opacity-0 group-hover:opacity-100 mr-2" />
  </button>
);
