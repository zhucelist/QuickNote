import React, { useState } from 'react';
import clsx from 'clsx';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  value?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  fullWidth?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  value,
  onChange,
  variant = 'default',
  fullWidth = false,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const currentTab = value !== undefined ? value : activeTab;

  const handleTabChange = (tabId: string) => {
    if (value !== undefined) {
      onChange?.(tabId);
    } else {
      setActiveTab(tabId);
    }
  };

  const variants = {
    default: {
      container: 'bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg',
      tab: 'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
      active: 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm',
      inactive: 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200',
    },
    pills: {
      container: 'gap-2',
      tab: 'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
      active: 'bg-blue-500 text-white shadow-md shadow-blue-500/25',
      inactive: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700',
    },
    underline: {
      container: 'border-b border-zinc-200 dark:border-zinc-800',
      tab: 'px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 -mb-px',
      active: 'border-blue-500 text-blue-600 dark:text-blue-400',
      inactive: 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700',
    },
  };

  const style = variants[variant];

  return (
    <div className="w-full">
      <div className={clsx('flex', style.container, fullWidth && 'w-full')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && handleTabChange(tab.id)}
            disabled={tab.disabled}
            className={clsx(
              style.tab,
              currentTab === tab.id ? style.active : style.inactive,
              tab.disabled && 'opacity-50 cursor-not-allowed',
              fullWidth && 'flex-1 justify-center'
            )}
          >
            <span className="flex items-center gap-2 justify-center">
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tabs.find(tab => tab.id === currentTab)?.content}
      </div>
    </div>
  );
};

export default Tabs;
