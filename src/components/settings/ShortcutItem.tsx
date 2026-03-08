import { useState, useEffect } from 'react';

const formatShortcut = (shortcut: string) => {
  if (!shortcut) return '未设置';
  
  // 分割快捷键组合
  const keys = shortcut.split('+');
  
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, index) => {
        // 处理特殊键显示
        let displayKey = key
          .replace('Command', '⌘')
          .replace('Cmd', '⌘')
          .replace('Control', '⌃')
          .replace('Ctrl', '⌃')
          .replace('Option', '⌥')
          .replace('Opt', '⌥')
          .replace('Alt', '⌥')
          .replace('Shift', '⇧')
          .replace('ArrowUp', '↑')
          .replace('ArrowDown', '↓')
          .replace('ArrowLeft', '←')
          .replace('ArrowRight', '→')
          .replace('Enter', '↵')
          .replace('Backspace', '⌫')
          .replace('Delete', '⌦')
          .replace('Escape', 'Esc')
          .replace('Space', '␣');

        return (
          <span 
            key={index}
            className="
              inline-flex items-center justify-center 
              min-w-[20px] h-6 px-1.5 
              text-xs font-medium font-sans
              bg-white dark:bg-zinc-800 
              text-zinc-600 dark:text-zinc-300
              border-b-2 border-zinc-200 dark:border-zinc-700 
              rounded-[4px] shadow-sm
            "
          >
            {displayKey}
          </span>
        );
      })}
    </div>
  );
};

export const ShortcutItem = ({ 
  label, 
  value, 
  onChange, 
  onSave,
  description 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  description?: string;
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡

    // 如果按下 Escape，取消录制
    if (e.key === 'Escape') {
      setIsRecording(false);
      setCurrentValue(value);
      setError(null);
      return;
    }

    // 获取按下的键
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.metaKey) modifiers.push(navigator.platform.includes('Mac') ? 'Option' : 'Meta'); // Electron use Option for Alt on Mac? No, Option is Alt. 
    
    const isMac = navigator.platform.includes('Mac');
    
    const electronModifiers: string[] = [];
    if (e.metaKey) electronModifiers.push(isMac ? 'Command' : 'Meta');
    if (e.ctrlKey) electronModifiers.push('Ctrl');
    if (e.altKey) electronModifiers.push(isMac ? 'Option' : 'Alt');
    if (e.shiftKey) electronModifiers.push('Shift');

    // 获取主键
    let key = e.code.replace('Key', '').replace('Digit', '');
    
    // 处理特殊键
    if (key === 'Space') key = 'Space';
    if (key.startsWith('Arrow')) key = key.replace('Arrow', '');
    
    // 如果只按下了修饰键，不保存
    if (['Control', 'Alt', 'Shift', 'Meta', 'Command', 'Option'].some(m => key === m || e.key === m)) {
      return;
    }

    const shortcut = [...electronModifiers, key].join('+');
    
    // 立即尝试保存
    saveNewShortcut(shortcut);
  };

  const saveNewShortcut = async (shortcut: string) => {
    if (shortcut === value) {
        setIsRecording(false);
        return;
    }
    
    // 简单校验格式
    if (!shortcut || shortcut.trim() === '') {
        setError('快捷键不能为空');
        return;
    }

    // 立即校验并保存
    try {
        const isAvailable = await window.ipcRenderer.invoke('check-shortcut-available', shortcut);
        if (!isAvailable) {
            setError('快捷键已被占用');
            // 保持录制状态，只显示错误
            return;
        }
        
        setError(null);
        if (onSave) {
            await onSave(shortcut); 
        } else {
            onChange(shortcut);
        }
        // 保存成功后退出录制
        setCurrentValue(shortcut);
        setIsRecording(false);
    } catch (e) {
        setError('验证快捷键失败');
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setError(null);
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
        {description && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{description}</span>
        )}
        {error && (
            <span className="text-xs text-red-500 font-medium animate-pulse">{error}</span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={isRecording ? undefined : startRecording}
          onKeyDown={handleKeyDown}
          className={`
            relative px-4 py-2 min-w-[140px] h-10
            flex items-center justify-center gap-1.5
            text-sm font-medium rounded-lg border
            transition-all duration-200 outline-none
            ${isRecording 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20' 
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }
          `}
        >
          {isRecording ? (
            <>
              <span className="animate-pulse">请输入快捷键...</span>
            </>
          ) : (
            <div className="flex items-center gap-1">
              {formatShortcut(currentValue || '未设置')}
            </div>
          )}
        </button>
        
        {isRecording && (
            <div className="flex gap-1">
                 <button 
                    onClick={() => {
                        setIsRecording(false);
                        setCurrentValue(value);
                        setError(null);
                    }}
                    className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                    title="取消"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
