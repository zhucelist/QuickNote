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
  onSave?: (value: string) => void | Promise<void>;
  description?: string;
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentValue(value);
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    if (isRecording) {
      const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          setIsRecording(false);
          setDisplayValue(value);
          setError(null);
          return;
        }

        const modifiers: string[] = [];
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        if (e.metaKey && isMac) modifiers.push('Command');
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push(isMac ? 'Option' : 'Alt');
        if (e.shiftKey) modifiers.push('Shift');

        // Get key code
        let key = e.code;
        
        // Clean up key code
        if (key.startsWith('Key')) key = key.slice(3);
        if (key.startsWith('Digit')) key = key.slice(5);
        if (key === 'Space') key = 'Space';
        
        // Special keys mapping
        const specialKeys: Record<string, string> = {
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            'Enter': 'Return',
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'Tab': 'Tab',
            'Escape': 'Esc'
        };
        
        if (specialKeys[key]) key = specialKeys[key];
        
        // If only modifiers are pressed, just show them
        if (['Control', 'Alt', 'Shift', 'Meta', 'Command', 'Option', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(key)) {
             const display = modifiers.join('+');
             setDisplayValue(display);
             return;
        }

        const shortcut = [...modifiers, key].join('+');
        setDisplayValue(shortcut);
        
        // Validate and save
        // Allow at least one modifier OR double key press (e.g. Option+Space, or F1)
        // But for "double key" logic (like Ctrl+Ctrl), Electron doesn't support it natively in globalShortcut.
        // User asked for "two repetitive keys", maybe they mean "Double Shift" or "Double Ctrl".
        // Electron globalShortcut does NOT support "Double Click" style shortcuts directly.
        // However, if the user means "Allow shortcuts like 'Ctrl+C' AND 'Ctrl+V' (not repetitive keys, but multiple shortcuts)", that's different.
        // Assuming the user means "Modifier+Key" logic is too strict, and wants to allow simple keys like "F1" or "MediaNextTrack".
        
        // Relaxed validation: Allow if there are modifiers OR if it's a Function key / Special key
        const isFunctionKey = key.match(/^F\d+$/);
        const isMediaKey = ['MediaNextTrack', 'MediaPreviousTrack', 'MediaStop', 'MediaPlayPause', 'VolumeUp', 'VolumeDown', 'VolumeMute'].includes(key);
        
        if (modifiers.length > 0 && !['Control', 'Alt', 'Shift', 'Meta', 'Command', 'Option'].includes(key)) {
             handleSave(shortcut);
        } else if (isFunctionKey || isMediaKey) {
             handleSave(shortcut);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isRecording, value]);

  const handleSave = (shortcut: string) => {
      // 简单校验
      if (!shortcut) return;
      
      onChange(shortcut);
      if (onSave) {
        void onSave(shortcut);
      }
      setIsRecording(false);
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
              <span className="animate-pulse">{displayValue || '请输入快捷键...'}</span>
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
