import React, { useState, useEffect, useRef, useCallback } from 'react';
import { recognizeText } from '../utils/ocr';
import { OCRDialog } from '../components/Screenshot/OCRDialog';
import { 
  Square, 
  Circle, 
  ArrowUpRight, 
  Pencil, 
  Grid3X3, 
  Type, 
  Download, 
  X, 
  Check,
  Pin,
  AppWindow,
  Undo,
  Redo,
  Move,
  MousePointer2
} from 'lucide-react';

interface WindowInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawElement {
  id: string;
  type: 'rect' | 'circle' | 'arrow' | 'brush' | 'mosaic' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  text?: string;
}

type ResizeHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null;

const ScreenshotPage: React.FC = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [showWindowSelector, setShowWindowSelector] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectStartRef = useRef({ x: 0, y: 0 });
  
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, y: 0, selection: {} as Selection });
  
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolColor, setToolColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(2);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const [elements, setElements] = useState<DrawElement[]>([]);
  const currentElementRef = useRef<DrawElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [, forceRender] = useState({});
  
  const [history, setHistory] = useState<DrawElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [ocrPosition, setOcrPosition] = useState({ x: 0, y: 0 });
  const [toolbarPosition, setToolbarPosition] = useState<{ left: number; top: number } | null>(null);
  const [selectionScreenRect, setSelectionScreenRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const getCroppedImage = useCallback(() => {
    if (!selection || selection.width < 10 || selection.height < 10) return null;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !canvasRef.current) return null;
    
    canvas.width = selection.width;
    canvas.height = selection.height;
    
    ctx.drawImage(
      canvasRef.current,
      selection.x, selection.y, selection.width, selection.height,
      0, 0, selection.width, selection.height
    );
    
    return canvas.toDataURL('image/png');
  }, [selection]);

  const handleConfirm = useCallback(() => {
    const image = getCroppedImage();
    if (image) {
      window.ipcRenderer.send('save-screenshot', { dataURL: image });
    }
    window.ipcRenderer.send('close-screenshot');
  }, [getCroppedImage]);

  const handleClose = useCallback(() => {
    window.ipcRenderer.send('close-screenshot');
  }, []);

  const saveHistory = useCallback((newElements: DrawElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newElements]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements([...history[historyIndex - 1]]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setElements([]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements([...history[historyIndex + 1]]);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const handleScreenshotData = (_event: unknown, data: string) => {
      console.log('[Screenshot] Received screenshot data, length:', data?.length);
      setScreenshot(data);
      const img = new Image();
      img.onload = () => {
        console.log('[Screenshot] Image loaded, size:', img.width, 'x', img.height);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      img.onerror = (err) => {
        console.error('[Screenshot] Failed to load image:', err);
      };
      img.src = data;
    };

    window.ipcRenderer.on('screenshot-data', handleScreenshotData);
    detectWindows();

    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, 3000);

    return () => {
      window.ipcRenderer.off('screenshot-data', handleScreenshotData);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (selection && selection.width >= 10 && selection.height >= 10) {
          handleConfirm();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selection, handleConfirm, handleClose, undo, redo]);

  const detectWindows = useCallback(async () => {
    try {
      const detectedWindows: WindowInfo[] = await window.ipcRenderer.invoke('detect-windows');
      setWindows(detectedWindows || []);
    } catch (error) {
      console.log('[Screenshot] Window detection not available');
    }
  }, []);

  const getMousePos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  const getResizeHandle = useCallback((x: number, y: number): ResizeHandle => {
    if (!selection) return null;
    
    const handleSize = 10;
    const left = selection.x;
    const right = selection.x + selection.width;
    const top = selection.y;
    const bottom = selection.y + selection.height;
    
    if (Math.abs(x - left) < handleSize && Math.abs(y - top) < handleSize) return 'nw';
    if (Math.abs(x - right) < handleSize && Math.abs(y - top) < handleSize) return 'ne';
    if (Math.abs(x - left) < handleSize && Math.abs(y - bottom) < handleSize) return 'sw';
    if (Math.abs(x - right) < handleSize && Math.abs(y - bottom) < handleSize) return 'se';
    
    if (Math.abs(y - top) < handleSize && x > left && x < right) return 'n';
    if (Math.abs(y - bottom) < handleSize && x > left && x < right) return 's';
    if (Math.abs(x - left) < handleSize && y > top && y < bottom) return 'w';
    if (Math.abs(x - right) < handleSize && y > top && y < bottom) return 'e';
    
    if (x > left && x < right && y > top && y < bottom) return 'move';
    
    return null;
  }, [selection]);

  const getCursorStyle = useCallback((handle: ResizeHandle): string => {
    switch (handle) {
      case 'nw':
      case 'se': return 'nwse-resize';
      case 'ne':
      case 'sw': return 'nesw-resize';
      case 'n':
      case 's': return 'ns-resize';
      case 'w':
      case 'e': return 'ew-resize';
      case 'move': return 'move';
      default: return activeTool ? 'crosshair' : 'default';
    }
  }, [activeTool]);

  // 更新工具栏位置 - 智能边缘检测
  const updateToolbarPosition = useCallback(() => {
    if (!selection || selection.width < 10 || selection.height < 10 || !containerRef.current || !canvasRef.current) {
      setToolbarPosition(null);
      return;
    }
    
    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    
    // 将选择区域的 canvas 坐标转换为屏幕坐标
    const selectionScreenX = canvasRect.left + selection.x * scaleX;
    const selectionScreenY = canvasRect.top + selection.y * scaleY;
    const selectionScreenWidth = selection.width * scaleX;
    const selectionScreenHeight = selection.height * scaleY;
    const selectionScreenRight = selectionScreenX + selectionScreenWidth;
    const selectionScreenBottom = selectionScreenY + selectionScreenHeight;
    
    // 工具栏尺寸估算（包含颜色选择器）
    const toolbarWidth = 560; // 主工具栏宽度
    const toolbarHeight = 75; // 主工具栏高度
    const colorPickerHeight = 50; // 颜色选择器高度
    const totalHeight = activeTool && showColorPicker ? toolbarHeight + colorPickerHeight + 8 : toolbarHeight;
    const margin = 8; // 边距
    
    // 获取窗口尺寸
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let toolbarX: number;
    let toolbarY: number;
    
    // 计算四个方向可用空间
    const spaceBelow = windowHeight - selectionScreenBottom - margin;
    const spaceAbove = selectionScreenY - margin;
    
    // 垂直位置决策 - 优先选择空间更大的方向
    const canFitBelow = spaceBelow >= totalHeight;
    const canFitAbove = spaceAbove >= totalHeight;
    
    if (!canFitBelow && canFitAbove) {
      // 下方空间不够，上方够，显示在上方
      toolbarY = selectionScreenY - totalHeight - margin;
    } else if (canFitBelow) {
      // 下方空间够，默认显示在下方
      toolbarY = selectionScreenBottom + margin;
    } else if (canFitAbove) {
      // 上下都不够，但上方相对较大
      toolbarY = margin;
    } else {
      // 上下空间都不够，优先显示在下方（可能被截断但通常底部截图时用户会滚动）
      toolbarY = Math.max(margin, Math.min(selectionScreenBottom + margin, windowHeight - totalHeight - margin));
    }
    
    // 确保工具栏不会超出屏幕顶部和底部
    toolbarY = Math.max(margin, Math.min(toolbarY, windowHeight - totalHeight - margin));
    
    // 水平位置调整
    // 默认左对齐到选择区域左侧
    toolbarX = selectionScreenX;
    
    // 检查是否会超出右边界
    if (toolbarX + toolbarWidth > windowWidth - margin) {
      // 会超出右边界，尝试右对齐
      toolbarX = selectionScreenRight - toolbarWidth;
    }
    
    // 检查是否会超出左边界
    if (toolbarX < margin) {
      toolbarX = margin;
    }
    
    // 最终边界检查
    toolbarX = Math.max(margin, Math.min(toolbarX, windowWidth - toolbarWidth - margin));
    
    setToolbarPosition({ left: toolbarX, top: toolbarY });
  }, [selection, activeTool, showColorPicker]);

  const updateSelectionScreenRect = useCallback(() => {
    if (!selection || selection.width < 10 || selection.height < 10 || !canvasRef.current) {
      setSelectionScreenRect(null);
      return;
    }

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;

    setSelectionScreenRect({
      left: canvasRect.left + selection.x * scaleX,
      top: canvasRect.top + selection.y * scaleY,
      width: selection.width * scaleX,
      height: selection.height * scaleY,
    });
  }, [selection]);

  // 当选择区域变化时更新工具栏位置
  useEffect(() => {
    updateToolbarPosition();
  }, [updateToolbarPosition]);

  useEffect(() => {
    updateSelectionScreenRect();
  }, [updateSelectionScreenRect]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      updateToolbarPosition();
      updateSelectionScreenRect();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateToolbarPosition, updateSelectionScreenRect]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !screenshot) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      [...elements, currentElementRef.current].filter(Boolean).forEach(el => {
        if (!el) return;
        
        switch (el.type) {
          case 'rect':
            if (el.width && el.height) {
              ctx.strokeStyle = el.color;
              ctx.lineWidth = el.lineWidth;
              ctx.strokeRect(el.x, el.y, el.width, el.height);
            }
            break;
          case 'circle':
            if (el.width && el.height) {
              ctx.strokeStyle = el.color;
              ctx.lineWidth = el.lineWidth;
              ctx.beginPath();
              ctx.ellipse(
                el.x + el.width / 2,
                el.y + el.height / 2,
                Math.abs(el.width / 2),
                Math.abs(el.height / 2),
                0, 0, Math.PI * 2
              );
              ctx.stroke();
            }
            break;
          case 'arrow':
            if (el.width && el.height) {
              ctx.strokeStyle = el.color;
              ctx.fillStyle = el.color;
              ctx.lineWidth = el.lineWidth;
              drawArrow(ctx, el.x, el.y, el.x + el.width, el.y + el.height);
            }
            break;
          case 'brush':
            if (el.points && el.points.length > 1) {
              ctx.strokeStyle = el.color;
              ctx.lineWidth = el.lineWidth;
              ctx.beginPath();
              ctx.moveTo(el.points[0].x, el.points[0].y);
              el.points.forEach(p => ctx.lineTo(p.x, p.y));
              ctx.stroke();
            }
            break;
          case 'mosaic':
            if (el.points && el.points.length > 1) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(el.points[0].x, el.points[0].y);
              el.points.forEach(p => ctx.lineTo(p.x, p.y));
              ctx.closePath();
              ctx.clip();
              
              const pixelSize = 10;
              for (let x = 0; x < canvas.width; x += pixelSize) {
                for (let y = 0; y < canvas.height; y += pixelSize) {
                  const imageData = ctx.getImageData(x, y, 1, 1);
                  const [r, g, b] = imageData.data;
                  ctx.fillStyle = `rgb(${r},${g},${b})`;
                  ctx.fillRect(x, y, pixelSize, pixelSize);
                }
              }
              ctx.restore();
            }
            break;
        }
      });
      
      if (selection) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, selection.y);
        ctx.fillRect(0, selection.y + selection.height, canvas.width, canvas.height - selection.y - selection.height);
        ctx.fillRect(0, selection.y, selection.x, selection.height);
        ctx.fillRect(selection.x + selection.width, selection.y, canvas.width - selection.x - selection.width, selection.height);
      }
    };
    img.src = screenshot;
  }, [screenshot, selection, elements]);

  useEffect(() => {
    let animationId: number;
    const animate = () => {
      renderCanvas();
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [renderCanvas]);

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const headlen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const pos = getMousePos(e);
    
    if (activeTool && selection) {
      setIsDrawing(true);
      const newElement: DrawElement = {
        id: Date.now().toString(),
        type: activeTool as DrawElement['type'],
        x: pos.x,
        y: pos.y,
        color: toolColor,
        lineWidth,
        points: [{ x: pos.x, y: pos.y }]
      };
      currentElementRef.current = newElement;
      return;
    }
    
    const handle = getResizeHandle(pos.x, pos.y);
    
    if (handle && selection) {
      setResizeHandle(handle);
      setIsResizing(true);
      resizeStartRef.current = { 
        x: pos.x, 
        y: pos.y, 
        selection: { ...selection } 
      };
    } else if (!activeTool) {
      setIsSelecting(true);
      selectStartRef.current = pos;
      setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  }, [activeTool, getMousePos, toolColor, lineWidth, selection, getResizeHandle]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      
      if (!isSelecting && !isResizing && !isDrawing) {
        const handle = getResizeHandle(pos.x, pos.y);
        if (containerRef.current) {
          containerRef.current.style.cursor = getCursorStyle(handle);
        }
      }
      
      if (isSelecting) {
        const x = Math.min(selectStartRef.current.x, pos.x);
        const y = Math.min(selectStartRef.current.y, pos.y);
        const width = Math.abs(pos.x - selectStartRef.current.x);
        const height = Math.abs(pos.y - selectStartRef.current.y);
        setSelection({ x, y, width, height });
      } else if (isResizing && selection && resizeHandle) {
        const dx = pos.x - resizeStartRef.current.x;
        const dy = pos.y - resizeStartRef.current.y;
        const startSel = resizeStartRef.current.selection;
        
        const newSelection = { ...selection };
        
        switch (resizeHandle) {
          case 'move':
            newSelection.x = startSel.x + dx;
            newSelection.y = startSel.y + dy;
            break;
          case 'se':
            newSelection.width = Math.max(10, startSel.width + dx);
            newSelection.height = Math.max(10, startSel.height + dy);
            break;
          case 'nw':
            newSelection.x = startSel.x + dx;
            newSelection.y = startSel.y + dy;
            newSelection.width = Math.max(10, startSel.width - dx);
            newSelection.height = Math.max(10, startSel.height - dy);
            break;
          case 'ne':
            newSelection.y = startSel.y + dy;
            newSelection.width = Math.max(10, startSel.width + dx);
            newSelection.height = Math.max(10, startSel.height - dy);
            break;
          case 'sw':
            newSelection.x = startSel.x + dx;
            newSelection.width = Math.max(10, startSel.width - dx);
            newSelection.height = Math.max(10, startSel.height + dy);
            break;
          case 'n':
            newSelection.y = startSel.y + dy;
            newSelection.height = Math.max(10, startSel.height - dy);
            break;
          case 's':
            newSelection.height = Math.max(10, startSel.height + dy);
            break;
          case 'w':
            newSelection.x = startSel.x + dx;
            newSelection.width = Math.max(10, startSel.width - dx);
            break;
          case 'e':
            newSelection.width = Math.max(10, startSel.width + dx);
            break;
        }
        
        setSelection(newSelection);
      } else if (isDrawing && currentElementRef.current) {
        if (activeTool === 'brush' || activeTool === 'mosaic') {
          currentElementRef.current = {
            ...currentElementRef.current,
            points: [...(currentElementRef.current.points || []), { x: pos.x, y: pos.y }]
          };
        } else {
          currentElementRef.current = {
            ...currentElementRef.current,
            width: pos.x - currentElementRef.current.x,
            height: pos.y - currentElementRef.current.y
          };
        }
        forceRender({});
      }
    };

    const handleMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
      } else if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
      } else if (isDrawing && currentElementRef.current) {
        setIsDrawing(false);
        const newElements = [...elements, currentElementRef.current];
        setElements(newElements);
        saveHistory(newElements);
        currentElementRef.current = null;
      }
    };

    if (isSelecting || isResizing || isDrawing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isSelecting, isResizing, isDrawing, selection, resizeHandle, activeTool, getMousePos, getResizeHandle, getCursorStyle, elements, saveHistory]);

  const handleOCR = useCallback(async () => {
    const image = getCroppedImage();
    if (!image) return;
    
    setOcrPosition({
      x: (selection?.x || 0) + (selection?.width || 0) + 20,
      y: selection?.y || 0
    });
    setShowOcrDialog(true);
    setOcrLoading(true);
    
    try {
      const result = await recognizeText(image);
      setOcrText(result.text);
    } catch (error) {
      setOcrText('识别失败');
    } finally {
      setOcrLoading(false);
    }
  }, [getCroppedImage, selection]);

  const handlePin = useCallback(() => {
    const image = getCroppedImage();
    if (!image || !selection) return;
    
    window.ipcRenderer.send('pin-image', {
      dataURL: image,
      bounds: {
        x: Math.round(selection.x),
        y: Math.round(selection.y),
        width: Math.round(selection.width),
        height: Math.round(selection.height),
      },
    });
    window.ipcRenderer.send('close-screenshot');
  }, [getCroppedImage, selection]);

  const handleSave = useCallback(() => {
    const image = getCroppedImage();
    if (image) {
      window.ipcRenderer.send('save-screenshot-file', { dataURL: image });
    }
    window.ipcRenderer.send('close-screenshot');
  }, [getCroppedImage]);

  const handleSelectWindow = useCallback((win: WindowInfo) => {
    setSelection({ x: win.x, y: win.y, width: win.width, height: win.height });
    setShowWindowSelector(false);
  }, []);

  const tools = [
    { id: 'rect', icon: Square, title: '矩形', desc: '绘制矩形框' },
    { id: 'circle', icon: Circle, title: '圆形', desc: '绘制圆形' },
    { id: 'arrow', icon: ArrowUpRight, title: '箭头', desc: '绘制箭头' },
    { id: 'brush', icon: Pencil, title: '画笔', desc: '自由绘制' },
    { id: 'mosaic', icon: Grid3X3, title: '马赛克', desc: '马赛克涂抹' },
    { id: 'text', icon: Type, title: '文字', desc: '添加文字' },
  ];

  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff'];

  const hasSelection = selection && selection.width >= 10 && selection.height >= 10;

  if (!screenshot) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50">
        <div className="text-white text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black/30">
      {showOverlay && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] transition-opacity duration-500"
          onClick={() => setShowOverlay(false)}
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <MousePointer2 size={48} className="text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">截图模式</h2>
            <p className="text-zinc-300 text-lg">拖拽鼠标选择截图区域</p>
            <p className="text-zinc-400 text-sm mt-4">点击任意处关闭提示</p>
          </div>
        </div>
      )}

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-zinc-900/70 text-zinc-100 text-xs backdrop-blur border border-white/10 shadow-lg flex items-center gap-2">
          <span>拖拽选择</span>
          <span className="text-zinc-400">·</span>
          <span>Enter 完成</span>
          <span className="text-zinc-400">·</span>
          <span>Esc 取消</span>
          <span className="text-zinc-400">·</span>
          <span>⌘/Ctrl + Z 撤销</span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {selectionScreenRect && hasSelection && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            left: selectionScreenRect.left,
            top: selectionScreenRect.top,
            width: selectionScreenRect.width,
            height: selectionScreenRect.height,
          }}
        >
          <div className="absolute inset-0 rounded-sm border-2 border-blue-400" />
          <div className="absolute -top-7 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap shadow">
            {Math.round(selection.width)} × {Math.round(selection.height)}
          </div>

          <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-white border border-blue-500 shadow" />
          <div className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-full bg-white border border-blue-500 shadow" />
          <div className="absolute -left-1.5 -bottom-1.5 w-3 h-3 rounded-full bg-white border border-blue-500 shadow" />
          <div className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-full bg-white border border-blue-500 shadow" />
        </div>
      )}

      {/* 工具栏 - 跟随选择区域显示 */}
      {toolbarPosition && hasSelection && (
        <div 
          className="fixed z-50 transition-all duration-200"
          style={{
            left: toolbarPosition.left,
            top: toolbarPosition.top,
          }}
        >
          <div className="flex flex-col items-start gap-2">
            <div 
              className="flex items-center gap-1 bg-zinc-800/95 backdrop-blur-xl rounded-xl px-2 py-2 shadow-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={() => { setActiveTool(null); setShowColorPicker(false); }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    !activeTool ? 'bg-blue-500 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                  }`}
                  title="选择区域"
                >
                  <Move size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">选择</span>
              </div>
              
              <div className="w-px h-10 bg-zinc-600 mx-1" />
              
              {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <div key={tool.id} className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => { 
                        setActiveTool(isActive ? null : tool.id); 
                        setShowColorPicker(!isActive);
                      }}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        isActive ? 'bg-blue-500 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                      }`}
                      title={tool.desc}
                    >
                      <Icon size={18} />
                    </button>
                    <span className="text-[10px] text-zinc-400">{tool.title}</span>
                  </div>
                );
              })}
              
              <div className="w-px h-10 bg-zinc-600 mx-1" />
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={undo}
                  disabled={historyIndex < 0}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                  title="撤销上一步 (Ctrl+Z)"
                >
                  <Undo size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">撤销</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                  title="重做 (Ctrl+Shift+Z)"
                >
                  <Redo size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">重做</span>
              </div>
              
              <div className="w-px h-10 bg-zinc-600 mx-1" />
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={() => setShowWindowSelector(true)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
                  title="选择窗口"
                >
                  <AppWindow size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">窗口</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={handleOCR}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
                  title="文字识别"
                >
                  <Type size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">识别</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={handlePin}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
                  title="贴图到屏幕"
                >
                  <Pin size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">贴图</span>
              </div>
              
              <div className="w-px h-10 bg-zinc-600 mx-1" />
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={handleSave}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
                  title="保存到文件"
                >
                  <Download size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">保存</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={handleClose}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
                  title="取消截图"
                >
                  <X size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">取消</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={handleConfirm}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500 text-white hover:bg-green-600"
                  title="完成截图"
                >
                  <Check size={18} />
                </button>
                <span className="text-[10px] text-zinc-400">完成</span>
              </div>
            </div>
            
            {activeTool && showColorPicker && (
              <div 
                className="flex items-center gap-1 bg-zinc-800/95 backdrop-blur-xl rounded-full px-3 py-2 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setToolColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      toolColor === color ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                
                <div className="w-px h-4 bg-zinc-600 mx-2" />
                
                {[1, 2, 3, 4].map((width) => (
                  <button
                    key={width}
                    onClick={() => setLineWidth(width)}
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      lineWidth === width ? 'bg-zinc-600' : ''
                    }`}
                  >
                    <div 
                      className="rounded-full bg-white"
                      style={{ width: width * 2, height: width * 2 }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showWindowSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-zinc-700">
            <h3 className="text-lg font-semibold mb-4 text-white">选择窗口</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {windows.length === 0 ? (
                <p className="text-zinc-400 text-center py-4">未检测到窗口，请手动拖拽选择区域</p>
              ) : (
                windows.map((win, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectWindow(win)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="font-medium text-white truncate">{win.title}</div>
                    <div className="text-sm text-zinc-400">{win.width} × {win.height}</div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowWindowSelector(false)}
              className="mt-4 w-full px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

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

export default ScreenshotPage;
