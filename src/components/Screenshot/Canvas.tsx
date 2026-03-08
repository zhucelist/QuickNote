import React, { useRef, useEffect } from 'react';
// @ts-ignore
import { fabric } from 'fabric';

interface CanvasProps {
  onSelectionChange: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  tool: string;
  actionRef: React.MutableRefObject<any>; // Use any or a specific interface
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  backgroundImage: string | null;
}

export const Canvas: React.FC<CanvasProps> = ({ onSelectionChange, tool, actionRef, onHistoryChange, backgroundImage }) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const selectionRef = useRef<fabric.Rect | null>(null);
  const drawingObjectRef = useRef<fabric.Object | null>(null);
  
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isHistoryProcessing = useRef(false);
  const isSelectingRef = useRef(false);

  const saveHistory = () => {
      if (!canvasRef.current || isHistoryProcessing.current) return;
      
      const json = JSON.stringify(canvasRef.current.toJSON(['id']));
      
      // 如果当前不在历史记录末尾，丢弃后面的记录
      if (historyIndexRef.current < historyRef.current.length - 1) {
          historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      }
      
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;
      
      updateHistoryState();
  };

  // Move helper functions outside of useEffect or use refs
  const updateOverlayRef = useRef<() => void>(() => {});
  const bindSelectionEventsRef = useRef<(rect: fabric.Rect) => void>(() => {});

  const updateHistoryState = () => {
      onHistoryChange(
          historyIndexRef.current > 0, // canUndo (0 is initial state)
          historyIndexRef.current < historyRef.current.length - 1 // canRedo
      );
  };

    const handleUndo = () => {
        // 修复：允许 index 为 0 (初始状态)，这样可以回退到 index -1 (空白)
        if (historyIndexRef.current < 0) return;
        
        isHistoryProcessing.current = true;
        historyIndexRef.current -= 1;
        
        // 如果回退到 -1，说明要回到初始空白状态
        if (historyIndexRef.current < 0) {
             historyIndexRef.current = -1;
             
             if (!canvasRef.current) return;
             const canvas = canvasRef.current;
             
             // 清空所有对象
             canvas.clear();
             
             // 重新加载背景图 (如果存在)
             if (backgroundImage) {
                 fabric.Image.fromURL(backgroundImage, (img) => {
                    const scaleX = (canvas.width || window.innerWidth) / (img.width || 1);
                    const scaleY = (canvas.height || window.innerHeight) / (img.height || 1);
                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                        scaleX, scaleY, originX: 'left', originY: 'top'
                    });
                    
                    // 重建遮罩层
                    const overlayOpts = {
                        fill: 'rgba(0,0,0,0.5)',
                        selectable: false, evented: false, hoverCursor: 'default',
                    };
                    const top = new fabric.Rect({ ...overlayOpts, width: canvas.width, height: canvas.height, left: 0, top: 0 });
                    const bottom = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
                    const left = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
                    const right = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
                    canvas.add(top, bottom, left, right);
                    overlayRefs.current = { top, bottom, left, right };
                    
                    // 重置选区状态
                    selectionRef.current = null;
                    onSelectionChange(null);
                    
                    isHistoryProcessing.current = false;
                    updateHistoryState();
                 });
             } else {
                 isHistoryProcessing.current = false;
                 updateHistoryState();
             }
             return;
        }

        const json = historyRef.current[historyIndexRef.current];
        
        canvasRef.current?.loadFromJSON(json, () => {
            canvasRef.current?.renderAll();
            isHistoryProcessing.current = false;
            updateHistoryState();
            
            // 恢复 selectionRef
            const objects = canvasRef.current?.getObjects();
            const rect = objects?.find(o => 
                o.type === 'rect' && 
                o.stroke === '#3b82f6' && 
                o.fill === 'transparent'
            ); 
            
            if (rect) {
                selectionRef.current = rect as fabric.Rect;
                canvasRef.current?.setActiveObject(rect);
                updateOverlayRef.current();
                
                onSelectionChange({
                  x: rect.left || 0,
                  y: rect.top || 0,
                  width: (rect.width || 0) * (rect.scaleX || 1),
                  height: (rect.height || 0) * (rect.scaleY || 1)
                });
                
                bindSelectionEventsRef.current(rect as fabric.Rect);

            } else {
                selectionRef.current = null;
                onSelectionChange(null);
                updateOverlayRef.current();
            }
        });
    };

  const handleRedo = () => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      
      isHistoryProcessing.current = true;
      historyIndexRef.current += 1;
      const json = historyRef.current[historyIndexRef.current];
      
      canvasRef.current?.loadFromJSON(json, () => {
          canvasRef.current?.renderAll();
          isHistoryProcessing.current = false;
          updateHistoryState();
          
          const objects = canvasRef.current?.getObjects();
          const rect = objects?.find(o => o.type === 'rect' && (o as any).id === 'selection-rect');
          if (rect) {
              selectionRef.current = rect as fabric.Rect;
          } else {
              selectionRef.current = null;
              onSelectionChange(null);
          }
      });
  };

  const cssVar = (name: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  const cssNumber = (name: string, fallback: number) => {
    const v = cssVar(name, String(fallback));
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  };
  const cssAnchorType = () => cssVar('--anchor-type', 'all');
  const activeColorRef = useRef('#ef4444');
  const activeSizeRef = useRef(3);

  const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
      } : null;
  };

  const updateBrush = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const color = activeColorRef.current;
      const size = activeSizeRef.current;
      
      if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = color;
          canvas.freeDrawingBrush.width = size;
          
          if (toolRef.current === 'highlighter') {
               // Highlighter is always semi-transparent
               const rgb = hexToRgb(color);
               if (rgb) {
                   canvas.freeDrawingBrush.color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
               }
               canvas.freeDrawingBrush.width = size * 5; // Highlighter is thicker
          }
      }
  };

  // Expose actions
  useEffect(() => {
      actionRef.current = {
          undo: handleUndo,
          redo: handleRedo,
          getDataURL: (selection: any) => {
              if (!canvasRef.current) return null;
              
              const canvas = canvasRef.current;
              // Temporary hide controls
              const activeObj = canvas.getActiveObject();
              if (activeObj) {
                  activeObj.visible = false; // Hide selection rect
                  canvas.renderAll();
              }
              
              // We need to crop the canvas
              const scaleFactor = window.devicePixelRatio || 1;
              const { x, y, width, height } = selection;
              
              const dataURL = canvas.toDataURL({
                  left: x,
                  top: y,
                  width: width,
                  height: height,
                  format: 'png',
                  multiplier: scaleFactor
              });
              
              if (activeObj) {
                  activeObj.visible = true;
                  canvas.renderAll();
              }
              return dataURL;
          },
          setColor: (color: string) => {
              activeColorRef.current = color;
              updateBrush();
          },
          setSize: (size: number) => {
              activeSizeRef.current = size;
              updateBrush();
          }
      };
  }, []);

  // ... (useEffect for canvas init)
  
  // Update init logic to save initial history
  useEffect(() => {
    // ... (existing init code)
    
    // After init
    if (canvasRef.current) {
        // Save initial blank state
        saveHistory();
        
        // Free drawing (highlighter/mosaic) fires path:created
        canvasRef.current.on('path:created', () => {
             if (!isHistoryProcessing.current) saveHistory();
        });
        
        canvasRef.current.on('object:modified', () => {
            if (!isHistoryProcessing.current) saveHistory();
        });
        // object:removed logic might be tricky with selection rect clearing
    }
  }, []);

  const startPosRef = useRef({ x: 0, y: 0 });
  const toolRef = useRef(tool);

  const stampCounterRef = useRef(1);

  // Update background image
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !backgroundImage) return;
      
      fabric.Image.fromURL(backgroundImage, (img) => {
          // Calculate scale to fit canvas
          const scaleX = (canvas.width || window.innerWidth) / (img.width || 1);
          const scaleY = (canvas.height || window.innerHeight) / (img.height || 1);
          
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
              scaleX,
              scaleY,
              originX: 'left',
              originY: 'top'
          });
      });
  }, [backgroundImage]);

  // 同步 tool 到 ref
  useEffect(() => {
    toolRef.current = tool;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Reset drawing mode
    canvas.isDrawingMode = false;
    
    if (tool === 'highlighter') {
        canvas.isDrawingMode = true;
        // @ts-ignore
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.5)';
        canvas.freeDrawingBrush.width = 20;
    }
    // Mosaic handled in mouse down as a rect
  }, [tool]);
  
  // 遮罩层引用
  const overlayRefs = useRef<{
      top: fabric.Rect;
      bottom: fabric.Rect;
      left: fabric.Rect;
      right: fabric.Rect;
  } | null>(null);

  useEffect(() => {
    if (!canvasEl.current) return;

    // 初始化 fabric 画布
    // @ts-ignore
    const canvas = new fabric.Canvas(canvasEl.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      selection: false, // 禁用默认多选框
      defaultCursor: 'crosshair',
      preserveObjectStacking: true, // 保持对象层级
      backgroundColor: 'transparent',
    });
    canvasRef.current = canvas;
    
    // 初始化遮罩层 (全屏半透明)
    const overlayOpts = {
        fill: cssVar('--mask-color', 'rgba(0,0,0,0.5)'),
        selectable: false,
        evented: false,
        hoverCursor: 'default',
    };
    
    const top = new fabric.Rect({ ...overlayOpts, width: canvas.width, height: canvas.height, left: 0, top: 0 });
    const bottom = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
    const left = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
    const right = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
    
    canvas.add(top, bottom, left, right);
    overlayRefs.current = { top, bottom, left, right };

    // 默认进入选择模式
    // 但我们的逻辑是 mousedown 生成选区
    // 确保画布能接收事件
    canvas.renderAll();

    // 修复：初始化时 toolRef 可能还没同步
    toolRef.current = tool;

    // 定义 updateOverlay
    const updateOverlay = () => {
        const rect = selectionRef.current;
        const overlays = overlayRefs.current;
        
        if (!canvas || !overlays) return;
        
        if (!rect) {
            // 没有选区，全屏遮罩
            overlays.top.set({ width: canvas.width, height: canvas.height, left: 0, top: 0 });
            overlays.bottom.set({ width: 0, height: 0 });
            overlays.left.set({ width: 0, height: 0 });
            overlays.right.set({ width: 0, height: 0 });
        } else {
            // 有选区，根据选区位置更新 4 个遮罩矩形
            const { left = 0, top = 0 } = rect;
            const width = (rect.width || 0) * (rect.scaleX || 1);
            const height = (rect.height || 0) * (rect.scaleY || 1);
            
            const w = canvas.width || 0;
            const h = canvas.height || 0;
            
            overlays.top.set({ left: 0, top: 0, width: w, height: top });
            overlays.bottom.set({ left: 0, top: top + height, width: w, height: h - (top + height) });
            overlays.left.set({ left: 0, top: top, width: left, height: height });
            overlays.right.set({ left: left + width, top: top, width: w - (left + width), height: height });
        }
        
        canvas.requestRenderAll();
    };
    updateOverlayRef.current = updateOverlay;

    const bindSelectionEvents = (rect: fabric.Rect) => {
        // 监听选区变化事件 (缩放、移动)
        const update = () => {
             updateOverlay();
             const currentRect = selectionRef.current;
             if (currentRect) {
                 onSelectionChange({
                    x: currentRect.left || 0,
                    y: currentRect.top || 0,
                    width: (currentRect.width || 0) * (currentRect.scaleX || 1),
                    height: (currentRect.height || 0) * (currentRect.scaleY || 1)
                });
             }
        };

        // 避免重复绑定
        rect.off('modified');
        rect.off('moving');
        rect.off('scaling');

        rect.on('modified', update);
        rect.on('moving', update);
        rect.on('scaling', update);
        
        // Save history on modify end
        rect.on('modified', () => {
            saveHistory();
        });
    };
    bindSelectionEventsRef.current = bindSelectionEvents;

    // 事件处理函数
    const handleMouseDown = (opt: fabric.IEvent) => {
        // 必须从 ref 获取最新状态，闭包问题
        const currentTool = toolRef.current;
        if (!canvas) return;

        // 如果是 highlighter，直接返回，因为 isDrawingMode 已经处理了
        if (currentTool === 'highlighter') {
            return;
        }
    
        // 绘图逻辑
        if (currentTool !== 'select') {
            // 如果没有选区，不允许绘图 (除非你想支持全屏绘图，但通常截图工具是在选区内绘图)
            if (!selectionRef.current) {
                 return;
            }
            
            // 检查点击位置是否在选区内
            const rect = selectionRef.current;
            const pointer = canvas.getPointer(opt.e);
            
            // 考虑选区的缩放
            const left = rect.left || 0;
            const top = rect.top || 0;
            const width = (rect.width || 0) * (rect.scaleX || 1);
            const height = (rect.height || 0) * (rect.scaleY || 1);
            
            const isInside = 
                pointer.x >= left && 
                pointer.x <= left + width &&
                pointer.y >= top && 
                pointer.y <= top + height;

            // 如果点击在选区外，且当前不是选择工具，则什么都不做 (防止重置选区)
            if (!isInside) return;
            
            // **关键修复：如果点击的是已有的绘图对象，不要开始新的绘图**
            if (opt.target && opt.target !== selectionRef.current) {
                // 允许移动已有的绘图对象
                // 但如果当前是在 'select' 模式以外的工具模式，我们应该优先绘图还是移动？
                // 通常如果是在 rect 模式，点击一个已有的 rect，应该是移动它还是画新的？
                // 这里我们假设用户想移动，或者我们可以根据是否点中控制点来判断
                
                // 但为了简单，如果用户选了工具，通常是想画新的。
                // 除非点击的是选中对象。
                
                // 现在的逻辑是：只要点到了非选区的对象，就不画新的，允许选择/移动。
                // 这解决了“移动的过程中还会绘画”的问题。
                return;
            }

            isSelectingRef.current = true;
            startPosRef.current = { x: pointer.x, y: pointer.y };
    
            let shape: fabric.Object | null = null;
            const commonOpts = {
                left: pointer.x,
                top: pointer.y,
                stroke: activeColorRef.current,
                strokeWidth: activeSizeRef.current,
                fill: 'transparent',
                selectable: false, // 初始不可选，绘制完成后变为可选
                evented: false,
                originX: 'left',
                originY: 'top'
            };
            
            // ... (rest of drawing logic)
            
            // 确保这部分代码块结束时 return，不要让它跑到下面的选区重置逻辑
            if (currentTool === 'rect') {
                shape = new fabric.Rect({ ...commonOpts, width: 0, height: 0 });
            } else if (currentTool === 'circle') {
                shape = new fabric.Ellipse({ ...commonOpts, rx: 0, ry: 0 });
            } else if (currentTool === 'arrow') {
                 // 简单的直线，最后再加箭头
                 shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                    ...commonOpts,
                    fill: activeColorRef.current,
                    stroke: activeColorRef.current,
                 });
            } else if (currentTool === 'text') {
                const text = new fabric.IText('', {
                    ...commonOpts,
                    left: pointer.x,
                    top: pointer.y,
                    fontSize: activeSizeRef.current * 8, // Scale font size
                    fill: activeColorRef.current,
                    stroke: undefined, 
                });
                canvas.add(text);
                canvas.setActiveObject(text);
                text.enterEditing();
                saveHistory();
                return;
            } else if (currentTool === 'stamp') {
                const counter = stampCounterRef.current++;
                const circle = new fabric.Circle({
                    radius: activeSizeRef.current * 4,
                    fill: activeColorRef.current,
                    originX: 'center',
                    originY: 'center',
                    left: 0, top: 0
                });
                const text = new fabric.Text(counter.toString(), {
                    fontSize: activeSizeRef.current * 5,
                    fill: 'white',
                    originX: 'center',
                    originY: 'center',
                    left: 0, top: 0
                });
                const group = new fabric.Group([circle, text], {
                    ...commonOpts,
                    originX: 'center',
                    originY: 'center',
                    left: pointer.x,
                    top: pointer.y,
                    selectable: true, 
                    evented: true
                });
                canvas.add(group);
                saveHistory();
                return; 
            } else if (currentTool === 'spotlight') {
                 shape = new fabric.Rect({ 
                     ...commonOpts, 
                     width: 0, height: 0,
                     fill: 'rgba(255, 255, 0, 0.3)',
                     stroke: 'yellow'
                 });
            } else if (currentTool === 'mosaic') {
                 const patternCanvas = document.createElement('canvas');
                 patternCanvas.width = 10;
                 patternCanvas.height = 10;
                 const ctx = patternCanvas.getContext('2d');
                 if (ctx) {
                     ctx.fillStyle = '#ccc';
                     ctx.fillRect(0,0,5,5);
                     ctx.fillRect(5,5,5,5);
                     ctx.fillStyle = '#999';
                     ctx.fillRect(5,0,5,5);
                     ctx.fillRect(0,5,5,5);
                 }
                 
                 const pattern = new fabric.Pattern({
                     source: patternCanvas as any,
                     repeat: 'repeat'
                 });
                 
                 shape = new fabric.Rect({ 
                     ...commonOpts, 
                     width: 0, height: 0,
                     fill: pattern,
                     strokeWidth: 0
                 });
            }
    
            if (shape) {
                drawingObjectRef.current = shape;
                canvas.add(shape);
                canvas.requestRenderAll();
            }
            // 关键：绘图逻辑结束，必须 return，否则会继续执行下面的选区逻辑
            return;
        }
        
        // --- 下面是选区逻辑 (currentTool === 'select') ---

        // 如果已经有选区
        if (selectionRef.current) {
            // 如果点击的是选区本身 (或其控制点)
            if (opt.target === selectionRef.current) {
                return;
            }
            
            // 额外检查：如果 opt.target 为空，但点击位置在选区内
            // 防止误触导致选区重置
            const rect = selectionRef.current;
            const pointer = canvas.getPointer(opt.e);
            
            const left = rect.left || 0;
            const top = rect.top || 0;
            const width = (rect.width || 0) * (rect.scaleX || 1);
            const height = (rect.height || 0) * (rect.scaleY || 1);
            
            const isInside = 
                pointer.x >= left && 
                pointer.x <= left + width &&
                pointer.y >= top && 
                pointer.y <= top + height;
                
            if (isInside) {
                // 手动激活选区
                canvas.setActiveObject(rect);
                return;
            }
        }
        
        // 清除旧选区
        if (selectionRef.current) {
            canvas.remove(selectionRef.current);
            selectionRef.current = null;
            onSelectionChange(null);
        }
        
        const pointer = canvas.getPointer(opt.e);
        isSelectingRef.current = true;
        startPosRef.current = { x: pointer.x, y: pointer.y };
        
        const rect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: cssVar('--border-color', '#3b82f6'),
            strokeWidth: cssNumber('--border-width', 2),
            selectable: true,
            hasBorders: true,
            hasControls: true,
            lockRotation: true,
            transparentCorners: false,
            cornerColor: 'white',
            cornerStrokeColor: cssVar('--border-color', '#3b82f6'),
            borderColor: cssVar('--border-color', '#3b82f6'),
            cornerStyle: 'circle',
            cornerSize: 8,
        });
        
        selectionRef.current = rect;
        canvas.add(rect);
        canvas.setActiveObject(rect);
        updateOverlay();

        // 根据锚点配置控制显示
        const type = cssAnchorType();
        if (type === 'none') {
            rect.set({ hasControls: false });
        } else if (type === 'corner') {
            rect.set({ hasControls: true });
            rect.setControlsVisibility?.({
                mt: false, mb: false, ml: false, mr: false,
                tl: true, tr: true, bl: true, br: true,
                mtr: false
            } as any);
        } else {
            rect.set({ hasControls: true });
            rect.setControlsVisibility?.({
                mt: true, mb: true, ml: true, mr: true,
                tl: true, tr: true, bl: true, br: true,
                mtr: false
            } as any);
        }
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
        const currentTool = toolRef.current;
        if (!isSelectingRef.current || !canvas) return;
        
        const pointer = canvas.getPointer(opt.e);
        const start = startPosRef.current;
    
        // 绘图逻辑
        if (currentTool !== 'select' && drawingObjectRef.current) {
            const shape = drawingObjectRef.current;
            const width = Math.abs(pointer.x - start.x);
            const height = Math.abs(pointer.y - start.y);
            const left = Math.min(pointer.x, start.x);
            const top = Math.min(pointer.y, start.y);

            if (currentTool === 'rect' || currentTool === 'spotlight' || currentTool === 'mosaic') {
                shape.set({ width, height, left, top });
            } else if (currentTool === 'circle') {
                 const rx = width / 2;
                 const ry = height / 2;
                 (shape as fabric.Ellipse).set({ rx, ry, left, top, width, height });
            } else if (currentTool === 'arrow') {
                 (shape as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
            }
            canvas.requestRenderAll();
            return;
        }
    
        // 选区逻辑
        if (selectionRef.current) {
            const rect = selectionRef.current;
            const width = Math.abs(pointer.x - start.x);
            const height = Math.abs(pointer.y - start.y);
            
            rect.set({
                width,
                height,
                left: Math.min(pointer.x, start.x),
                top: Math.min(pointer.y, start.y)
            });
            
            updateOverlay();
            canvas.requestRenderAll();
            
            // 通知父组件
            onSelectionChange({
                x: rect.left || 0,
                y: rect.top || 0,
                width: rect.width || 0,
                height: rect.height || 0
            });
        }
    };

    const handleMouseUp = () => {
        isSelectingRef.current = false;
        const currentTool = toolRef.current;
    
        // 绘图结束
        if (currentTool !== 'select') {
            if (drawingObjectRef.current) {
                const shape = drawingObjectRef.current;
                shape.setCoords();
                
                if (currentTool === 'arrow') {
                    // Add arrowhead
                    const line = shape as fabric.Line;
                    const x1 = line.x1 || 0;
                    const y1 = line.y1 || 0;
                    const x2 = line.x2 || 0;
                    const y2 = line.y2 || 0;
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    
                    const head = new fabric.Triangle({
                        width: activeSizeRef.current * 3,
                        height: activeSizeRef.current * 3,
                        fill: activeColorRef.current,
                        left: x2,
                        top: y2,
                        angle: angle + 90,
                        originX: 'center',
                        originY: 'center',
                        selectable: false,
                        evented: false
                    });
                    
                    const group = new fabric.Group([line, head], {
                        selectable: true,
                        evented: true
                    });
                    canvas?.remove(line);
                    canvas?.add(group);
                } else {
                     shape.set({ selectable: true, evented: true });
                }

                drawingObjectRef.current = null;
                saveHistory();
            }
            // For highlighter/mosaic, history is handled by 'path:created' event if needed, 
            // but fabric free drawing fires 'path:created'. We should listen to it.
            return;
        }
    
        // 选区结束
        if (selectionRef.current) {
            selectionRef.current.setCoords();
            
            bindSelectionEvents(selectionRef.current);
            saveHistory(); // Save initial selection state
        }
    };

    // 事件监听
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    
    // 窗口调整大小
    const handleResize = () => {
        canvas.setWidth(window.innerWidth);
        canvas.setHeight(window.innerHeight);
        updateOverlay();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      canvas.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []); // 依赖为空，只初始化一次

  // 处理工具变化
  useEffect(() => {
      const canvas = canvasRef.current;
      const rect = selectionRef.current;
      if (!canvas || !rect) return;
      
      if (tool === 'select') {
          rect.selectable = true;
          rect.evented = true;
          canvas.defaultCursor = 'crosshair';
          canvas.clipPath = undefined; // 清除剪裁
      } else {
          rect.selectable = false;
          rect.evented = false; // 禁止选区交互，防止误触
          canvas.defaultCursor = 'crosshair';
          
          // 设置剪裁路径为选区
          rect.clone((cloned: fabric.Rect) => {
              // 修正克隆对象的位置
              cloned.left = rect.left;
              cloned.top = rect.top;
              cloned.width = rect.width;
              cloned.height = rect.height;
              cloned.scaleX = rect.scaleX;
              cloned.scaleY = rect.scaleY;
              
              canvas.clipPath = cloned;
              canvas.requestRenderAll();
          });
      }
      canvas.requestRenderAll();
  }, [tool]);

  return <canvas ref={canvasEl} className="absolute top-0 left-0 w-full h-full" />;
};
