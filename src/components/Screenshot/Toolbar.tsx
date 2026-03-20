import React, { useState, useRef, useLayoutEffect } from 'react';
import { MousePointer2, Type, Square, Circle, ArrowRight, Check, X, RotateCcw, RotateCw, Stamp, Focus, Grid3x3, Brush, ScanText, Pin, Download, Pencil } from 'lucide-react';
import clsx from 'clsx';

interface ToolbarProps {
  onToolSelect: (tool: string) => void;
  onAction: (action: string) => void;
  activeTool: string;
  position: { x: number; y: number };
  canUndo: boolean;
  canRedo: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onToolSelect, onAction, activeTool, position, canUndo, canRedo }) => {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [hoveredButtonRect, setHoveredButtonRect] = useState<{ left: number, width: number } | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const actionTools = useRef(new Set(['ocr', 'pin', 'save']));

  // Use useLayoutEffect to measure and adjust position before paint
  useLayoutEffect(() => {
    const margin = 10;
    let { x, y } = position;

    if (toolbarRef.current) {
        // Get actual dimensions
        const toolbarWidth = toolbarRef.current.offsetWidth;
        const toolbarHeight = toolbarRef.current.offsetHeight;

        // Vertical adjustment
        if (y + toolbarHeight > window.innerHeight - margin) {
            y = window.innerHeight - toolbarHeight - margin;
        }
        if (y < margin) {
            y = margin;
        }

        // Horizontal adjustment
        // Since we use translate(-50%, 0), x represents the center point
        // Left edge: x - width/2
        // Right edge: x + width/2
        
        if (x - toolbarWidth / 2 < margin) {
            // Left edge overflow -> Shift center right
            x = toolbarWidth / 2 + margin;
        } else if (x + toolbarWidth / 2 > window.innerWidth - margin) {
            // Right edge overflow -> Shift center left
            x = window.innerWidth - toolbarWidth / 2 - margin;
        }
    }

    setAdjustedPosition({ x, y });
  }, [position, activeTool]); // Re-calculate when position or content (activeTool) changes

  const tools = [
    { id: 'select', icon: <MousePointer2 size={18} />, label: '选择' },
    { id: 'pen', icon: <Pencil size={18} />, label: '画笔', hasColor: true, hasSize: true },
    { id: 'rect', icon: <Square size={18} />, label: '矩形', hasColor: true, hasSize: true },
    { id: 'circle', icon: <Circle size={18} />, label: '椭圆', hasColor: true, hasSize: true },
    { id: 'arrow', icon: <ArrowRight size={18} />, label: '箭头', hasColor: true, hasSize: true },
    { id: 'text', icon: <Type size={18} />, label: '文字', hasColor: true, hasSize: true },
    { id: 'highlighter', icon: <Brush size={18} />, label: '荧光笔', hasColor: true, hasSize: true },
    { id: 'mosaic', icon: <Grid3x3 size={18} />, label: '马赛克', hasSize: true }, 
    { id: 'stamp', icon: <Stamp size={18} />, label: '序号' }, 
    { id: 'spotlight', icon: <Focus size={18} />, label: '聚光灯' }, 
    { id: 'ocr', icon: <ScanText size={18} />, label: '文字提取' }, 
    { id: 'pin', icon: <Pin size={18} />, label: '贴图' },
    { id: 'save', icon: <Download size={18} />, label: '保存' },
  ];

  // State for sub-toolbar
  const [activeColor, setActiveColor] = useState('#ef4444'); // Default red-500
  const [activeSize, setActiveSize] = useState(3);

  const colors = [
      '#ef4444', // red-500
      '#f59e0b', // amber-500
      '#eab308', // yellow-500
      '#22c55e', // green-500
      '#3b82f6', // blue-500
      '#a855f7', // purple-500
      '#ec4899', // pink-500
      '#000000', // black
      '#ffffff', // white
  ];

  const currentToolConfig = tools.find(t => t.id === activeTool);
  const showSubToolbar = currentToolConfig && (currentToolConfig.hasColor || currentToolConfig.hasSize);


  const handleMouseEnter = (label: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setHoveredTool(label);
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (parentRect) {
      setHoveredButtonRect({
        left: rect.left - parentRect.left,
        width: rect.width
      });
    }
  };
  
  return (
    <div 
      ref={toolbarRef}
      className="fixed z-50 flex flex-col items-center gap-2"
      style={{ 
        left: adjustedPosition.x, 
        top: adjustedPosition.y,
        transform: 'translate(-50%, 0)' 
      }}
    >
      {/* Main Toolbar */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-1 flex gap-1 relative">
          {/* Tooltip */}
          {hoveredTool && hoveredButtonRect && (
            <div 
                className="absolute -top-10 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-all duration-100 z-50"
                style={{
                    left: hoveredButtonRect.left + hoveredButtonRect.width / 2,
                    transform: 'translateX(-50%)'
                }}
            >
                {hoveredTool}
            </div>
          )}
          
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                if (actionTools.current.has(tool.id)) onAction(tool.id);
                else onToolSelect(tool.id);
              }}
              onMouseEnter={(e) => handleMouseEnter(tool.label, e)}
              onMouseLeave={() => setHoveredTool(null)}
              className={clsx(
                "p-2 rounded-md transition-colors relative group",
                !actionTools.current.has(tool.id) && activeTool === tool.id 
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              )}
            >
              {tool.icon}
            </button>
          ))}
          
          <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
          
          <button
            onClick={() => onAction('undo')}
            onMouseEnter={(e) => handleMouseEnter('撤销 (Ctrl+Z)', e)}
            onMouseLeave={() => setHoveredTool(null)}
            disabled={!canUndo}
            className={clsx(
                "p-2 rounded-md transition-colors",
                canUndo 
                    ? "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" 
                    : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
            )}
          >
            <RotateCcw size={18} />
          </button>
          
          <button
            onClick={() => onAction('redo')}
            onMouseEnter={(e) => handleMouseEnter('重做 (Ctrl+Y)', e)}
            onMouseLeave={() => setHoveredTool(null)}
            disabled={!canRedo}
            className={clsx(
                "p-2 rounded-md transition-colors",
                canRedo 
                    ? "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" 
                    : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
            )}
          >
            <RotateCw size={18} />
          </button>

          <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
          
          <button
            onClick={() => onAction('cancel')}
            onMouseEnter={(e) => handleMouseEnter('取消 (Esc)', e)}
            onMouseLeave={() => setHoveredTool(null)}
            className="p-2 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={18} />
          </button>
          <button
            onClick={() => onAction('confirm')}
            onMouseEnter={(e) => handleMouseEnter('完成 (Enter)', e)}
            onMouseLeave={() => setHoveredTool(null)}
            className="p-2 rounded-md text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <Check size={18} />
          </button>
      </div>

      {/* Sub Toolbar */}
      {showSubToolbar && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {currentToolConfig.hasSize && (
                  <div className="flex items-center gap-2 px-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={activeSize} 
                        onChange={(e) => {
                            const size = parseInt(e.target.value);
                            setActiveSize(size);
                            onAction(`size:${size}`);
                        }}
                        className="w-32 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                      />
                      <div className="w-3 h-3 rounded-full bg-zinc-400" />
                  </div>
              )}
              
              {currentToolConfig.hasColor && currentToolConfig.hasSize && (
                  <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
              )}

              {currentToolConfig.hasColor && (
                  <div className="flex items-center gap-1.5">
                      {colors.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                                setActiveColor(color);
                                onAction(`color:${color}`);
                            }}
                            className={clsx(
                                "w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-600 transition-transform hover:scale-110",
                                activeColor === color && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-800"
                            )}
                            style={{ backgroundColor: color }}
                          />
                      ))}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
