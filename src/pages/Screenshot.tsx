import React, { useState, useEffect, useRef } from 'react';
import { Toolbar } from '../components/Screenshot/Toolbar';
import { Canvas } from '../components/Screenshot/Canvas';
import { OCRDialog } from '../components/Screenshot/OCRDialog';
import { recognizeText } from '../utils/ocr';

export const ScreenshotPage: React.FC = () => {
  const [activeTool, setActiveTool] = useState('select');
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  
  // OCR State
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [ocrPosition, setOcrPosition] = useState({ x: 0, y: 0 });

  // Calculate toolbar position based on selection
  const toolbarPosition = selection 
    ? (() => {
        const toolbarHeight = 60; // 预估工具栏高度
        const margin = 10;
        
        let x = selection.x + selection.width / 2;
        let y = selection.y + selection.height + margin;
        
        // 检查底部是否有足够空间 (假设底部有 60px 的 Dock 或系统栏需要避让)
        if (y + toolbarHeight > window.innerHeight - 20) {
            // 底部空间不足，尝试放在选区上方
            // 上方位置：选区顶部 - 工具栏高度 - 边距
            const topY = selection.y - toolbarHeight - margin;
            
            // 检查上方是否有足够空间 (顶部通常没有 Dock，保留 10px 边距即可)
            if (topY > 10) {
                y = topY;
            } else {
                // 上下都不足（例如全屏截图），放在选区内部底部
                y = window.innerHeight - toolbarHeight - margin - 50; 
            }
        }
        
        return { x, y };
    })()
    : { x: window.innerWidth / 2, y: window.innerHeight - 80 };

  const selectionRef = useRef(selection);
  useEffect(() => {
      selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    // 设置截图模式下 body 透明
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    // 应用外观配置到 CSS 变量
    window.ipcRenderer.invoke('get-appearance-config').then((config) => {
      if (!config) return;
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
      setVar('--border-color', config.borderColor);
      setVar('--mask-color', hex8ToRgba(config.maskColor));
      setVar('--shadow-color', hex8ToRgba(config.shadowColor));
      document.documentElement.style.setProperty('--border-width', String(config.borderWidth ?? 2));
      if (config.anchorType) {
        document.documentElement.style.setProperty('--anchor-type', String(config.anchorType));
      }
    });

    const handleScreenshotData = (_event: unknown, data: string) => {
      setScreenshot(data);
    };

    window.ipcRenderer.on('screenshot-data', handleScreenshotData);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.ipcRenderer.send('close-screenshot');
      }

      // Enter to Confirm/Save
      if (e.key === 'Enter') {
          e.preventDefault();
          const currentSelection = selectionRef.current;
          if (currentSelection && canvasActionRef.current) {
              const dataURL = canvasActionRef.current.getDataURL(currentSelection);
              if (dataURL) {
                  window.ipcRenderer.send('save-screenshot', { ...currentSelection, dataURL });
              }
          }
      }
      
      // Ctrl+Z Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          canvasActionRef.current?.undo();
      }
      
      // Ctrl+Shift+Z or Ctrl+Y Redo
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') || 
          ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
          e.preventDefault();
          canvasActionRef.current?.redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.ipcRenderer.off('screenshot-data', handleScreenshotData);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectionChange = (rect: { x: number; y: number; width: number; height: number } | null) => {
    setSelection(rect);
  };

  const handleToolSelect = (tool: string) => {
    if (tool === 'ocr') {
        handleOCR();
        return;
    }
    if (tool === 'pin') {
        handlePin();
        return;
    }
    if (tool === 'scroll') {
        // TODO: Implement scrolling screenshot
        console.log('Long screenshot triggered');
        return;
    }
    if (tool === 'save') {
        handleSave();
        return;
    }
    setActiveTool(tool);
  };

  const handleSave = async () => {
      if (!selection || !canvasActionRef.current) return;
      
      const dataURL = canvasActionRef.current.getDataURL(selection);
      if (!dataURL) return;
      
      // Send to main process to save
      // Main process should handle dialog or default path
      window.ipcRenderer.send('save-screenshot-file', { dataURL });
      
      // Close after save
      window.ipcRenderer.send('close-screenshot');
  };

  const canvasActionRef = useRef<any>(null);

  const handleAction = (action: string) => {
    if (action === 'cancel') {
      window.ipcRenderer.send('close-screenshot');
    } else if (action === 'confirm') {
      window.ipcRenderer.send('save-screenshot', selection);
    }
  };

  const handleOCR = async () => {
      if (!selection || !canvasActionRef.current) return;
      
      const dataURL = canvasActionRef.current.getDataURL(selection);
      if (!dataURL) return;

      setOcrPosition({ 
          x: selection.x + selection.width + 20, 
          y: selection.y 
      });
      setShowOcrDialog(true);
      setOcrLoading(true);
      setOcrText('');

      try {
          const text = await recognizeText(dataURL);
          setOcrText(text);
      } catch (error) {
          console.error('OCR Error:', error);
          setOcrText('识别失败，请重试');
      } finally {
          setOcrLoading(false);
      }
  };

  const handlePin = () => {
      if (!selection || !canvasActionRef.current) return;
      
      const dataURL = canvasActionRef.current.getDataURL(selection);
      if (!dataURL) return;
      
      window.ipcRenderer.send('pin-image', { 
          dataURL, 
          bounds: { 
              x: Math.round(selection.x), 
              y: Math.round(selection.y), 
              width: Math.round(selection.width), 
              height: Math.round(selection.height) 
          } 
      });
      
      window.ipcRenderer.send('close-screenshot');
  };

  const handleToolbarAction = (action: string) => {
      if (action.startsWith('color:')) {
          const color = action.split(':')[1];
          if (canvasActionRef.current) {
              canvasActionRef.current.setColor(color);
          }
      } else if (action.startsWith('size:')) {
          const size = parseInt(action.split(':')[1]);
          if (canvasActionRef.current) {
              canvasActionRef.current.setSize(size);
          }
      } else if (action === 'undo') {
          canvasActionRef.current?.undo();
      } else if (action === 'redo') {
          canvasActionRef.current?.redo();
      } else if (action === 'confirm') {
          if (selection && canvasActionRef.current) {
              // Get data URL from canvas (includes drawings)
              const dataURL = canvasActionRef.current.getDataURL(selection);
              if (dataURL) {
                  window.ipcRenderer.send('save-screenshot', { ...selection, dataURL });
              } else {
                  // Fallback to original logic if no dataURL (shouldn't happen)
                  handleAction(action);
              }
          }
      } else {
          handleAction(action);
      }
  };
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  return (
    <div className="fixed inset-0 w-screen h-screen z-[9999] overflow-hidden" style={{ background: 'transparent' }}>
      
      {/* Canvas Layer for Drawing/Selection (Handles the dimming overlay) */}
      <div className="absolute inset-0 w-full h-full" style={{ zIndex: 10 }}>
        <Canvas 
            onSelectionChange={handleSelectionChange} 
            tool={activeTool} 
            actionRef={canvasActionRef}
            onHistoryChange={(undo, redo) => {
                setCanUndo(undo);
                setCanRedo(redo);
            }}
            backgroundImage={screenshot}
        />
      </div>

      {/* UI Layer */}
      {selection && (
        <div style={{ zIndex: 20 }}>
          {/* Size Info */}
          <div 
            className="absolute bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none"
            style={{ 
              left: selection.x, 
              top: Math.max(10, selection.y - 25) 
            }}
          >
            {Math.round(selection.width)} x {Math.round(selection.height)}
          </div>

          {/* Toolbar */}
          <Toolbar 
            activeTool={activeTool} 
            onToolSelect={handleToolSelect} 
            onAction={handleToolbarAction}
            position={toolbarPosition}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      )}

      {/* OCR Dialog */}
      {showOcrDialog && (
          <OCRDialog 
              text={ocrText} 
              loading={ocrLoading} 
              onClose={() => setShowOcrDialog(false)} 
              position={ocrPosition} 
          />
      )}
    </div>
  );
};
