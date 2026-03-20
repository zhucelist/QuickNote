import React, { useRef, useEffect, useCallback } from 'react';
// @ts-ignore
import { fabric } from 'fabric';

interface CanvasProps {
  onSelectionChange: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  tool: string;
  actionRef: React.MutableRefObject<any>;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  backgroundImage: string | null;
}

// 窗口信息接口
interface WindowInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}

export const Canvas: React.FC<CanvasProps> = ({ onSelectionChange, tool, actionRef, onHistoryChange, backgroundImage }) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const backgroundRef = useRef<fabric.Image | null>(null);
  const selectionRef = useRef<fabric.Rect | null>(null);
  const drawingObjectRef = useRef<fabric.Object | null>(null);
  
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isHistoryProcessing = useRef(false);
  const isSelectingRef = useRef(false);
  const isSpotlightActiveRef = useRef(false);
  const spotlightRectRef = useRef<fabric.Rect | null>(null);
  const selectionFill = useRef('rgba(0,0,0,0.001)');
  const dragModeRef = useRef<'selection' | 'draw' | 'spotlight' | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onHistoryChangeRef = useRef(onHistoryChange);

  const applyBackgroundImage = useCallback((canvas: fabric.Canvas, dataUrl: string) => {
    if (backgroundRef.current) {
      canvas.remove(backgroundRef.current);
      backgroundRef.current = null;
    }

    fabric.Image.fromURL(dataUrl, (img) => {
      const scaleX = (canvas.width || window.innerWidth) / (img.width || 1);
      const scaleY = (canvas.height || window.innerHeight) / (img.height || 1);

      img.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        scaleX,
        scaleY,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      });

      (img as any).excludeFromExport = false;
      (img as any).isBackground = true;

      backgroundRef.current = img;
      canvas.insertAt(img, 0, false);
      canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' } as any);
  }, []);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

  // 窗口检测相关
  const windowsRef = useRef<WindowInfo[]>([]);
  const isDetectingWindowsRef = useRef(false);

  const saveHistory = useCallback(() => {
    if (!canvasRef.current || isHistoryProcessing.current) return;
    
    const json = JSON.stringify(canvasRef.current.toJSON(['id', 'isSpotlight', 'isDrawingObject']));
    
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
    
    updateHistoryState();
  }, []);

  const updateHistoryState = useCallback(() => {
    onHistoryChangeRef.current(
      historyIndexRef.current > 0,
      historyIndexRef.current < historyRef.current.length - 1
    );
  }, []);

  // 智能窗口检测
  const detectWindows = useCallback(async () => {
    if (isDetectingWindowsRef.current) return;
    isDetectingWindowsRef.current = true;

    try {
      // 通过 Electron API 获取窗口信息
      const windows: WindowInfo[] = await window.ipcRenderer.invoke('detect-windows');
      windowsRef.current = windows || [];
    } catch (error) {
      console.log('[Canvas] Window detection not available');
      windowsRef.current = [];
    }

    isDetectingWindowsRef.current = false;
  }, []);

  // 查找鼠标位置下的窗口
  const findWindowAtPoint = useCallback((x: number, y: number): WindowInfo | null => {
    // 从后向前查找（最上层的窗口优先）
    for (let i = windowsRef.current.length - 1; i >= 0; i--) {
      const win = windowsRef.current[i];
      if (
        x >= win.x &&
        x <= win.x + win.width &&
        y >= win.y &&
        y <= win.y + win.height
      ) {
        return win;
      }
    }
    return null;
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    
    isHistoryProcessing.current = true;
    historyIndexRef.current -= 1;
    
    if (historyIndexRef.current < 0) {
      historyIndexRef.current = -1;
      
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      
      // 保存当前选区状态
      const currentSelection = selectionRef.current ? {
        left: selectionRef.current.left,
        top: selectionRef.current.top,
        width: selectionRef.current.width,
        height: selectionRef.current.height,
        scaleX: selectionRef.current.scaleX,
        scaleY: selectionRef.current.scaleY
      } : null;
      
      canvas.clear();
      
      if (backgroundImage) {
        applyBackgroundImage(canvas, backgroundImage);
      }
      
      const overlayOpts = {
        fill: cssVar('--mask-color', 'rgba(0,0,0,0.5)'),
        selectable: false, evented: false, hoverCursor: 'default',
      };
      const top = new fabric.Rect({ ...overlayOpts, width: canvas.width, height: canvas.height, left: 0, top: 0 });
      const bottom = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
      const left = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
      const right = new fabric.Rect({ ...overlayOpts, width: 0, height: 0 });
      (top as any).isOverlay = true;
      (bottom as any).isOverlay = true;
      (left as any).isOverlay = true;
      (right as any).isOverlay = true;
      canvas.add(top, bottom, left, right);
      overlayRefs.current = { top, bottom, left, right };
      
      if (currentSelection) {
        const rect = new fabric.Rect({
          ...currentSelection,
          fill: selectionFill.current,
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
        updateOverlayRef.current();
        bindSelectionEventsRef.current(rect);
        onSelectionChangeRef.current({
          x: rect.left || 0,
          y: rect.top || 0,
          width: (rect.width || 0) * (rect.scaleX || 1),
          height: (rect.height || 0) * (rect.scaleY || 1)
        });
      } else {
        selectionRef.current = null;
        onSelectionChangeRef.current(null);
        updateOverlayRef.current();
      }
      
      isHistoryProcessing.current = false;
      updateHistoryState();
      return;
    }

    const json = historyRef.current[historyIndexRef.current];
    
    canvasRef.current?.loadFromJSON(json, () => {
      canvasRef.current?.renderAll();
      isHistoryProcessing.current = false;
      updateHistoryState();
      
      // 恢复选区
      const objects = canvasRef.current?.getObjects();
      const rect = objects?.find(o => 
        o.type === 'rect' && 
        o.stroke === '#3b82f6' && 
        (o.fill === 'transparent' || o.fill === selectionFill.current) &&
        !(o as any).isSpotlight &&
        !(o as any).isDrawingObject
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
  }, [applyBackgroundImage, backgroundImage, updateHistoryState]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    
    isHistoryProcessing.current = true;
    historyIndexRef.current += 1;
    const json = historyRef.current[historyIndexRef.current];
    
    canvasRef.current?.loadFromJSON(json, () => {
      canvasRef.current?.renderAll();
      isHistoryProcessing.current = false;
      updateHistoryState();
      
      const objects = canvasRef.current?.getObjects();
      const rect = objects?.find(o => 
        o.type === 'rect' && 
        o.stroke === '#3b82f6' && 
        (o.fill === 'transparent' || o.fill === selectionFill.current) &&
        !(o as any).isSpotlight &&
        !(o as any).isDrawingObject
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
      } else {
        selectionRef.current = null;
        onSelectionChange(null);
        updateOverlayRef.current();
      }
    });
  }, [updateHistoryState]);

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

  const updateBrush = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const color = activeColorRef.current;
    const size = activeSizeRef.current;
    
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = size;
      
      if (toolRef.current === 'highlighter') {
        const rgb = hexToRgb(color);
        if (rgb) {
          canvas.freeDrawingBrush.color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
        }
        canvas.freeDrawingBrush.width = size * 5;
      }
    }
  }, []);

  // Expose actions
  useEffect(() => {
    actionRef.current = {
      undo: handleUndo,
      redo: handleRedo,
      hasEdits: () => {
        const canvas = canvasRef.current;
        if (!canvas) return false;
        const selection = selectionRef.current;
        return canvas.getObjects().some(obj => {
          if (selection && obj === selection) return false;
          if ((obj as any).isOverlay) return false;
          if ((obj as any).isBackground) return false;
          return true;
        });
      },
      deleteActiveObject: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        if (selectionRef.current && active === selectionRef.current) return;
        if ((active as any).isEditing) return;
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        saveHistory();
      },
      getDataURL: (selection: any) => {
        if (!canvasRef.current) return null;
        
        const canvas = canvasRef.current;
        const overlays = canvas.getObjects().filter(o => (o as any).isOverlay);
        const selectionObj = selectionRef.current;
        const activeObj = canvas.getActiveObject();
        const wasEditing = !!(activeObj as any)?.isEditing;
        if (wasEditing) (activeObj as any)?.exitEditing?.();
        canvas.discardActiveObject();

        const prevVisibility = new Map<fabric.Object, boolean>();
        const hide = (obj: fabric.Object | null | undefined) => {
          if (!obj) return;
          prevVisibility.set(obj, obj.visible ?? true);
          obj.visible = false;
        };

        overlays.forEach(hide);
        hide(selectionObj);
        canvas.renderAll();
        
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
        
        prevVisibility.forEach((v, obj) => {
          obj.visible = v;
        });
        if (activeObj) canvas.setActiveObject(activeObj);
        canvas.renderAll();
        return dataURL;
      },
      getOverlayDataURL: (selection: any) => {
        if (!canvasRef.current) return null;

        const canvas = canvasRef.current;
        const overlays = canvas.getObjects().filter(o => (o as any).isOverlay);
        const selectionObj = selectionRef.current;
        const activeObj = canvas.getActiveObject();
        const wasEditing = !!(activeObj as any)?.isEditing;
        if (wasEditing) (activeObj as any)?.exitEditing?.();
        canvas.discardActiveObject();
        const backgroundObj = backgroundRef.current;

        const prevVisibility = new Map<fabric.Object, boolean>();
        const hide = (obj: fabric.Object | null | undefined) => {
          if (!obj) return;
          prevVisibility.set(obj, obj.visible ?? true);
          obj.visible = false;
        };

        overlays.forEach(hide);
        hide(selectionObj);
        hide(backgroundObj as any);
        canvas.renderAll();

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

        prevVisibility.forEach((v, obj) => {
          obj.visible = v;
        });
        if (activeObj) canvas.setActiveObject(activeObj);
        canvas.renderAll();
        return dataURL;
      },
      setColor: (color: string) => {
        activeColorRef.current = color;
        updateBrush();
      },
      setSize: (size: number) => {
        activeSizeRef.current = size;
        updateBrush();
      },
      detectWindows: detectWindows,
    };
  }, [handleUndo, handleRedo, detectWindows, updateBrush]);

  const updateOverlayRef = useRef<() => void>(() => {});
  const bindSelectionEventsRef = useRef<(rect: fabric.Rect) => void>(() => {});
  const syncToolOnSelectionRef = useRef<() => void>(() => {});
  const overlayRefs = useRef<{ top: fabric.Rect; bottom: fabric.Rect; left: fabric.Rect; right: fabric.Rect; } | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const toolRef = useRef(tool);
  const stampCounterRef = useRef(1);

  // Update background image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !backgroundImage) return;
    
    applyBackgroundImage(canvas, backgroundImage);
  }, [applyBackgroundImage, backgroundImage]);

  // 同步 tool 到 ref
  useEffect(() => {
    toolRef.current = tool;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 重置聚光灯状态
    if (tool !== 'spotlight' && isSpotlightActiveRef.current) {
      isSpotlightActiveRef.current = false;
      spotlightRectRef.current = null;
    }
    
    canvas.isDrawingMode = false;
    
    if (tool === 'pen' || tool === 'highlighter') {
      canvas.isDrawingMode = true;
      // @ts-ignore
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      updateBrush();
    }

    syncToolOnSelectionRef.current();
  }, [tool]);

  // 初始化 Canvas
  useEffect(() => {
    if (!canvasEl.current) return;

    // @ts-ignore
    const canvas = new fabric.Canvas(canvasEl.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      selection: false,
      defaultCursor: 'crosshair',
      preserveObjectStacking: true,
      backgroundColor: 'transparent',
    });
    canvasRef.current = canvas;
    
    // 初始化遮罩层
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
    (top as any).isOverlay = true;
    (bottom as any).isOverlay = true;
    (left as any).isOverlay = true;
    (right as any).isOverlay = true;
    
    canvas.add(top, bottom, left, right);
    overlayRefs.current = { top, bottom, left, right };

    canvas.renderAll();
    toolRef.current = tool;

    // 定义 updateOverlay
    const updateOverlay = () => {
      const rect = selectionRef.current;
      const overlays = overlayRefs.current;
      
      if (!canvas || !overlays) return;
      
      if (!rect) {
        overlays.top.set({ width: canvas.width, height: canvas.height, left: 0, top: 0 });
        overlays.bottom.set({ width: 0, height: 0 });
        overlays.left.set({ width: 0, height: 0 });
        overlays.right.set({ width: 0, height: 0 });
      } else {
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

    const syncToolOnSelection = () => {
      const rect = selectionRef.current;
      if (!canvas || !rect) return;

      if (toolRef.current === 'select') {
        rect.set({ selectable: true, evented: true });
      } else {
        rect.set({ selectable: false, evented: false });
      }
      canvas.requestRenderAll();
    };
    syncToolOnSelectionRef.current = syncToolOnSelection;

    const createSelectionClipPath = () => {
      const rect = selectionRef.current;
      if (!rect) return undefined;
      const left = rect.left || 0;
      const top = rect.top || 0;
      const width = (rect.width || 0) * (rect.scaleX || 1);
      const height = (rect.height || 0) * (rect.scaleY || 1);
      return new fabric.Rect({
        left,
        top,
        width,
        height,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        absolutePositioned: true,
      });
    };

    const bindSelectionEvents = (rect: fabric.Rect) => {
      const update = () => {
        updateOverlay();
        const currentRect = selectionRef.current;
        if (currentRect) {
          onSelectionChangeRef.current({
            x: currentRect.left || 0,
            y: currentRect.top || 0,
            width: (currentRect.width || 0) * (currentRect.scaleX || 1),
            height: (currentRect.height || 0) * (currentRect.scaleY || 1)
          });
        }
      };

      rect.off('modified');
      rect.off('moving');
      rect.off('scaling');

      rect.on('modified', update);
      rect.on('moving', update);
      rect.on('scaling', update);
      
      rect.on('modified', () => {
        saveHistory();
      });
    };
    bindSelectionEventsRef.current = bindSelectionEvents;

    const startSelection = (pointer: { x: number; y: number }) => {
      if (!canvas) return;

      if (selectionRef.current) {
        canvas.remove(selectionRef.current);
        selectionRef.current = null;
        onSelectionChangeRef.current(null);
      }

      isSelectingRef.current = true;
      dragModeRef.current = 'selection';
      startPosRef.current = { x: pointer.x, y: pointer.y };

      const rect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        originX: 'left',
        originY: 'top',
        fill: selectionFill.current,
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
      syncToolOnSelection();

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

    // 鼠标事件处理
    const handleMouseDown = (opt: fabric.IEvent) => {
      const currentTool = toolRef.current;
      if (!canvas) return;

      // 荧光笔直接返回
      if (currentTool === 'highlighter' || currentTool === 'pen') {
        return;
      }

      const pointer = canvas.getPointer(opt.e);
      
      // 智能窗口检测 - 按住 Option/Alt 键时自动选择窗口
      if (currentTool === 'select' && (opt.e as MouseEvent).altKey && !selectionRef.current) {
        const win = findWindowAtPoint(pointer.x, pointer.y);
        if (win) {
          // 自动创建选区匹配窗口
          if (selectionRef.current) {
            canvas.remove(selectionRef.current);
          }
          
          const rect = new fabric.Rect({
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.height,
            fill: selectionFill.current,
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
          bindSelectionEvents(rect);
          syncToolOnSelection();
          
          onSelectionChangeRef.current({
            x: win.x,
            y: win.y,
            width: win.width,
            height: win.height
          });
          
          saveHistory();
          return;
        }
      }

      // 聚光灯工具 - 创建固定位置的聚光灯效果
      if (currentTool === 'spotlight') {
        if (opt.target && (opt.target as any).isSpotlight && !isSpotlightActiveRef.current) {
          canvas.setActiveObject(opt.target);
          return;
        }

        // 如果已经有聚光灯在创建中，先完成它
        if (isSpotlightActiveRef.current && spotlightRectRef.current) {
          spotlightRectRef.current.set({
            selectable: true,
            evented: true,
          });
          spotlightRectRef.current.setCoords();
          isSpotlightActiveRef.current = false;
          spotlightRectRef.current = null;
          saveHistory();
          return;
        }
        
        isSpotlightActiveRef.current = true;
        isSelectingRef.current = true;
        dragModeRef.current = 'spotlight';
        startPosRef.current = { x: pointer.x, y: pointer.y };
        
        const spotlight = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'rgba(255, 255, 0, 0.2)',
          stroke: 'rgba(255, 200, 0, 0.8)',
          strokeWidth: 2,
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
        });
        
        (spotlight as any).isSpotlight = true;
        spotlightRectRef.current = spotlight;
        drawingObjectRef.current = spotlight;
        canvas.add(spotlight);
        canvas.requestRenderAll();
        return;
      }

      // 绘图逻辑
      if (currentTool !== 'select') {
        if (!selectionRef.current) {
          startSelection(pointer);
          return;
        }
        
        const rect = selectionRef.current;
        const left = rect.left || 0;
        const top = rect.top || 0;
        const width = (rect.width || 0) * (rect.scaleX || 1);
        const height = (rect.height || 0) * (rect.scaleY || 1);
        
        const isInside = 
          pointer.x >= left && 
          pointer.x <= left + width &&
          pointer.y >= top && 
          pointer.y <= top + height;

        if (!isInside) return;
        
        // 如果点击的是已有的绘图对象，不开始新的绘图
        if (opt.target && opt.target !== selectionRef.current) {
          return;
        }

        isSelectingRef.current = true;
        dragModeRef.current = 'draw';
        startPosRef.current = { x: pointer.x, y: pointer.y };

        let shape: fabric.Object | null = null;
        const commonOpts = {
          left: pointer.x,
          top: pointer.y,
          stroke: activeColorRef.current,
          strokeWidth: activeSizeRef.current,
          fill: 'transparent',
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
          isDrawingObject: true,
          clipPath: createSelectionClipPath(),
        };
        
        (commonOpts as any).isDrawingObject = true;
        
        if (currentTool === 'rect') {
          shape = new fabric.Rect({ ...commonOpts, width: 0, height: 0 });
        } else if (currentTool === 'circle') {
          shape = new fabric.Ellipse({ ...commonOpts, rx: 0, ry: 0 });
        } else if (currentTool === 'arrow') {
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
            fontSize: activeSizeRef.current * 8,
            fill: activeColorRef.current,
            stroke: undefined,
            selectable: true,
            evented: true,
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
            evented: true,
            clipPath: createSelectionClipPath(),
          });
          canvas.add(group);
          saveHistory();
          return;
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
        return;
      }

      // 选区逻辑
      if (selectionRef.current) {
        if (opt.target) return;
        
        const rect = selectionRef.current;
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
          canvas.setActiveObject(rect);
          canvas.requestRenderAll();
          return;
        }
      }

      // 创建新选区
      startSelection(pointer);
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (!isSelectingRef.current || !canvas) return;
      
      const pointer = canvas.getPointer(opt.e);
      const start = startPosRef.current;

      // 聚光灯移动
      if (dragModeRef.current === 'spotlight' && isSpotlightActiveRef.current && spotlightRectRef.current) {
        const width = Math.abs(pointer.x - start.x);
        const height = Math.abs(pointer.y - start.y);
        const left = Math.min(pointer.x, start.x);
        const top = Math.min(pointer.y, start.y);
        
        spotlightRectRef.current.set({ width, height, left, top });
        canvas.requestRenderAll();
        return;
      }

      // 绘图逻辑
      if (dragModeRef.current === 'draw' && drawingObjectRef.current) {
        const currentTool = toolRef.current;
        const shape = drawingObjectRef.current;
        const width = Math.abs(pointer.x - start.x);
        const height = Math.abs(pointer.y - start.y);
        const left = Math.min(pointer.x, start.x);
        const top = Math.min(pointer.y, start.y);

        if (currentTool === 'rect' || currentTool === 'mosaic') {
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
      if (dragModeRef.current === 'selection' && selectionRef.current) {
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
        
        onSelectionChangeRef.current({
          x: rect.left || 0,
          y: rect.top || 0,
          width: rect.width || 0,
          height: rect.height || 0
        });
      }
    };

    const handleMouseUp = () => {
      isSelectingRef.current = false;
      const mode = dragModeRef.current;
      dragModeRef.current = null;

      // 聚光灯结束
      if (mode === 'spotlight' && isSpotlightActiveRef.current && spotlightRectRef.current) {
        spotlightRectRef.current.set({
          selectable: true,
          evented: true,
        });
        spotlightRectRef.current.setCoords();
        isSpotlightActiveRef.current = false;
        spotlightRectRef.current = null;
        saveHistory();
        return;
      }

      // 绘图结束
      if (mode === 'draw' && drawingObjectRef.current) {
          const shape = drawingObjectRef.current;
          shape.setCoords();
          
          const currentTool = toolRef.current;
          if (currentTool === 'arrow') {
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
              evented: true,
              clipPath: createSelectionClipPath(),
            });
            canvas?.remove(line);
            canvas?.add(group);
          } else {
            shape.set({ selectable: true, evented: true });
          }

          drawingObjectRef.current = null;
          saveHistory();
        return;
      }

      // 选区结束
      if (mode === 'selection' && selectionRef.current) {
        selectionRef.current.setCoords();
        bindSelectionEvents(selectionRef.current);
        saveHistory();
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    
    canvas.on('path:created', () => {
      const path = canvas.getObjects().slice(-1)[0] as any;
      if (path && (toolRef.current === 'pen' || toolRef.current === 'highlighter') && selectionRef.current) {
        path.clipPath = createSelectionClipPath();
        path.setCoords?.();
      }
      if (!isHistoryProcessing.current) saveHistory();
    });
    
    canvas.on('object:modified', () => {
      if (!isHistoryProcessing.current) saveHistory();
    });
    
    const handleResize = () => {
      canvas.setWidth(window.innerWidth);
      canvas.setHeight(window.innerHeight);
      updateOverlay();
    };
    window.addEventListener('resize', handleResize);

    // 初始化时检测窗口
    detectWindows();

    return () => {
      canvas.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [detectWindows, findWindowAtPoint, saveHistory]);

  return <canvas ref={canvasEl} className="absolute top-0 left-0 w-full h-full" />;
};
