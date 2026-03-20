import { useState, useEffect, useCallback } from 'react';
import { Keyboard, RotateCcw, AlertCircle, Check, X, Command } from 'lucide-react';
import clsx from 'clsx';

interface ShortcutConfig {
  showClipboard: string;
  screenshot: string;
  pin: string;
  search: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  showClipboard: 'Option+V',
  screenshot: 'Option+A',
  pin: 'Option+P',
  search: 'Ctrl+Q',
};

const SHORTCUT_DEFINITIONS = [
  {
    key: 'showClipboard' as const,
    label: '打开剪贴板',
    description: '呼出主窗口并显示剪贴板历史',
    icon: '📋',
  },
  {
    key: 'screenshot' as const,
    label: '截图',
    description: '开始屏幕区域截图',
    icon: '📸',
  },
  {
    key: 'pin' as const,
    label: '贴图',
    description: '将剪贴板内容贴为浮动窗口',
    icon: '📌',
  },
  {
    key: 'search' as const,
    label: '搜索',
    description: '打开全局搜索',
    icon: '🔍',
  },
];

// 格式化快捷键显示
const formatShortcut = (shortcut: string): string => {
  if (!shortcut) return '未设置';
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  return shortcut
    .replace('Command', isMac ? '⌘' : 'Ctrl')
    .replace('Cmd', isMac ? '⌘' : 'Ctrl')
    .replace('Control', isMac ? '⌃' : 'Ctrl')
    .replace('Ctrl', isMac ? '⌃' : 'Ctrl')
    .replace('Option', isMac ? '⌥' : 'Alt')
    .replace('Opt', isMac ? '⌥' : 'Alt')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('Shift', '⇧')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('Enter', '↵')
    .replace('Return', '↵')
    .replace('Backspace', '⌫')
    .replace('Delete', '⌦')
    .replace('Escape', 'Esc')
    .replace('Space', '␣');
};

export const ShortcutSettings = () => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS);
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutConfig | null>(null);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // 加载快捷键配置
  useEffect(() => {
    window.ipcRenderer.invoke('get-shortcuts').then((config: Partial<ShortcutConfig>) => {
      setShortcuts({ ...DEFAULT_SHORTCUTS, ...config });
    });
  }, []);

  // 检查快捷键冲突
  const checkConflict = useCallback(async (shortcut: string): Promise<boolean> => {
    if (!shortcut) return false;
    const isAvailable = await window.ipcRenderer.invoke('check-shortcut-available', shortcut);
    return !isAvailable;
  }, []);

  // 保存快捷键
  const saveShortcut = async (key: keyof ShortcutConfig, value: string) => {
    try {
      const success = await window.ipcRenderer.invoke('update-shortcut', key, value);
      
      if (success) {
        setShortcuts(prev => ({ ...prev, [key]: value }));
        setSavedKeys(prev => new Set(prev).add(key));
        
        setTimeout(() => {
          setSavedKeys(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 2000);
        
        return true;
      } else {
        setConflicts(prev => new Set(prev).add(key));
        return false;
      }
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      return false;
    }
  };

  // 开始录制
  const startRecording = (key: keyof ShortcutConfig) => {
    setRecordingKey(key);
    setConflicts(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // 取消录制
  const cancelRecording = () => {
    setRecordingKey(null);
  };

  // 清除快捷键
  const clearShortcut = async (key: keyof ShortcutConfig) => {
    await saveShortcut(key, '');
  };

  // 恢复默认
  const resetToDefault = async () => {
    for (const [key, value] of Object.entries(DEFAULT_SHORTCUTS)) {
      await saveShortcut(key as keyof ShortcutConfig, value);
    }
  };

  // 监听键盘事件
  useEffect(() => {
    if (!recordingKey) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        cancelRecording();
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifiers: string[] = [];

      if (e.metaKey && isMac) modifiers.push('Command');
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push(isMac ? 'Option' : 'Alt');
      if (e.shiftKey) modifiers.push('Shift');

      let key = e.code;
      
      if (key.startsWith('Key')) key = key.slice(3);
      if (key.startsWith('Digit')) key = key.slice(5);
      if (key === 'Space') key = 'Space';
      
      const specialKeys: Record<string, string> = {
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        'Enter': 'Return',
        'NumpadEnter': 'Return',
      };
      
      if (specialKeys[key]) key = specialKeys[key];
      
      if (['Control', 'Alt', 'Shift', 'Meta', 'Command', 'Option'].includes(key)) {
        return;
      }

      const shortcut = [...modifiers, key].join('+');
      
      const isFunctionKey = key.match(/^F\d+$/);
      const isMediaKey = ['MediaNextTrack', 'MediaPreviousTrack', 'MediaStop', 'MediaPlayPause'].includes(key);
      
      if (modifiers.length > 0 || isFunctionKey || isMediaKey) {
        const hasConflict = await checkConflict(shortcut);
        
        if (hasConflict) {
          setConflicts(prev => new Set(prev).add(recordingKey));
        } else {
          await saveShortcut(recordingKey, shortcut);
        }
        
        setRecordingKey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingKey, checkConflict]);

  return (
    <div className="min-h-full p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl">
              <Keyboard className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">快捷键设置</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">自定义应用快捷键</p>
            </div>
          </div>
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <RotateCcw size={14} />
            恢复默认
          </button>
        </div>

        {/* 快捷键列表 */}
        <div className="space-y-3">
          {SHORTCUT_DEFINITIONS.map((def) => {
            const isRecording = recordingKey === def.key;
            const hasConflict = conflicts.has(def.key);
            const isSaved = savedKeys.has(def.key);
            const value = shortcuts[def.key];

            return (
              <div
                key={def.key}
                className={clsx(
                  "bg-white dark:bg-zinc-900 rounded-xl border p-4 transition-all duration-200",
                  isRecording
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : hasConflict
                    ? 'border-red-300 dark:border-red-800'
                    : isSaved
                    ? 'border-green-300 dark:border-green-800'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{def.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {def.label}
                        </span>
                        {isSaved && (
                          <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                            <Check size={10} />
                            已保存
                          </span>
                        )}
                        {hasConflict && (
                          <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                            <AlertCircle size={10} />
                            冲突
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {def.description}
                      </span>
                    </div>
                  </div>

                  {/* 快捷键输入区域 */}
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded-lg animate-pulse">
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            按下快捷键...
                          </span>
                        </div>
                        <button
                          onClick={cancelRecording}
                          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          title="取消"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startRecording(def.key)}
                          className={clsx(
                            "relative px-4 py-2 min-w-[100px]",
                            "flex items-center justify-center",
                            "text-sm font-medium rounded-lg border",
                            "transition-all duration-200",
                            hasConflict
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400'
                              : value
                              ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-blue-400 dark:hover:border-blue-600'
                              : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 border-dashed'
                          )}
                        >
                          {value ? formatShortcut(value) : '点击设置'}
                        </button>
                        
                        {value && (
                          <button
                            onClick={() => clearShortcut(def.key)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="清除"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 录制提示 */}
                {isRecording && (
                  <div className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                    按 Esc 取消
                  </div>
                )}

                {/* 冲突提示 */}
                {hasConflict && (
                  <div className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle size={14} />
                    该快捷键可能与其他应用冲突，请尝试其他组合
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
            <Command size={14} />
            快捷键说明
          </h4>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <li>• 点击快捷键按钮后，按下想要的组合键即可设置</li>
            <li>• 支持修饰键组合：Ctrl/Cmd + 字母/数字/功能键</li>
            <li>• 支持单独的功能键：F1-F12</li>
            <li>• 按 Esc 取消录制</li>
            <li>• 如果快捷键冲突，会显示红色警告</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ShortcutSettings;
