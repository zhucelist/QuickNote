import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '../components/Screenshot/Canvas';
import { Toolbar } from '../components/Screenshot/Toolbar';
import { recognizeText } from '../utils/ocr';
import { OCRDialog } from '../components/Screenshot/OCRDialog';

type SelectionRect = { x: number; y: number; width: number; height: number };

const ScreenshotEditorPage: React.FC = () => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [tool, setTool] = useState<string>('select');
  const actionRef = useRef<any>({});
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrPosition, setOcrPosition] = useState({ x: 20, y: 80 });

  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const handleScreenshotData = (_event: unknown, data: string) => {
      setBackgroundImage(data);
    };

    window.ipcRenderer.on('screenshot-data', handleScreenshotData);
    return () => {
      window.ipcRenderer.off('screenshot-data', handleScreenshotData);
    };
  }, []);

  useEffect(() => {
    if (!backgroundImage) return;
    const t = window.setTimeout(() => setShowHint(false), 1600);
    return () => window.clearTimeout(t);
  }, [backgroundImage]);

  const clampSelection = useCallback((rect: SelectionRect): SelectionRect => {
    const x = Math.max(0, Math.min(rect.x, window.innerWidth));
    const y = Math.max(0, Math.min(rect.y, window.innerHeight));
    const width = Math.max(0, Math.min(rect.width, window.innerWidth - x));
    const height = Math.max(0, Math.min(rect.height, window.innerHeight - y));
    return { x, y, width, height };
  }, []);

  const [toolbarPosition, setToolbarPosition] = useState(() => {
    const margin = 18;
    return { x: window.innerWidth / 2, y: window.innerHeight - margin - 98 };
  });

  const recomputeToolbarPosition = useCallback(() => {
    const margin = 18;
    if (!selection) {
      setToolbarPosition({ x: window.innerWidth / 2, y: window.innerHeight - margin - 98 });
      return;
    }
    const s = clampSelection(selection);
    const gap = 14;
    const estimatedToolbarHeight = 92;
    const preferBelow = s.y + s.height + gap + estimatedToolbarHeight < window.innerHeight - margin;
    const y = preferBelow ? s.y + s.height + gap : Math.max(margin, s.y - gap - estimatedToolbarHeight);
    setToolbarPosition({ x: s.x + s.width / 2, y });
  }, [clampSelection, selection]);

  useEffect(() => {
    window.addEventListener('resize', recomputeToolbarPosition);
    recomputeToolbarPosition();
    return () => window.removeEventListener('resize', recomputeToolbarPosition);
  }, [recomputeToolbarPosition]);

  const exportSelectionDataUrl = useCallback(() => {
    if (!selection) return null;
    if (!actionRef.current?.getDataURL) return null;
    return actionRef.current.getDataURL(clampSelection(selection));
  }, [clampSelection, selection]);

  const exportOverlayDataUrl = useCallback(() => {
    if (!selection) return null;
    if (!actionRef.current?.getOverlayDataURL) return null;
    return actionRef.current.getOverlayDataURL(clampSelection(selection));
  }, [clampSelection, selection]);

  const composeImage = useCallback(async (baseDataUrl: string, overlayDataUrl: string) => {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
      });

    const baseImg = await load(baseDataUrl);
    const overlayImg = await load(overlayDataUrl);

    const c = document.createElement('canvas');
    c.width = baseImg.naturalWidth || baseImg.width;
    c.height = baseImg.naturalHeight || baseImg.height;
    const ctx = c.getContext('2d');
    if (!ctx) return baseDataUrl;

    ctx.drawImage(baseImg, 0, 0, c.width, c.height);
    ctx.drawImage(overlayImg, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, []);

  const handleCancel = useCallback(() => {
    window.ipcRenderer.send('close-screenshot');
  }, []);

  const handleConfirm = useCallback(() => {
    const run = async () => {
      if (!selection) return;
      const bounds = clampSelection(selection);
      const payload = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };

      const hasEdits = !!actionRef.current?.hasEdits?.();
      if (!hasEdits) {
        window.ipcRenderer.send('save-screenshot', payload);
        return;
      }

      const base = await window.ipcRenderer.invoke('crop-screenshot-dataurl', payload);
      const overlay = exportOverlayDataUrl();
      if (!base || !overlay) {
        const fallback = exportSelectionDataUrl();
        window.ipcRenderer.send('save-screenshot', { ...payload, ...(fallback ? { dataURL: fallback } : {}) });
        return;
      }

      const composed = await composeImage(base, overlay);
      window.ipcRenderer.send('save-screenshot', { ...payload, dataURL: composed });
    };
    run();
  }, [clampSelection, composeImage, exportOverlayDataUrl, exportSelectionDataUrl, selection]);

  const handleSaveFile = useCallback(() => {
    const run = async () => {
      if (!selection) return;
      const bounds = clampSelection(selection);
      const payload = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };

      const hasEdits = !!actionRef.current?.hasEdits?.();
      if (!hasEdits) {
        window.ipcRenderer.send('save-screenshot-file', payload);
        return;
      }

      const base = await window.ipcRenderer.invoke('crop-screenshot-dataurl', payload);
      const overlay = exportOverlayDataUrl();
      if (!base || !overlay) {
        const fallback = exportSelectionDataUrl();
        window.ipcRenderer.send('save-screenshot-file', { ...payload, ...(fallback ? { dataURL: fallback } : {}) });
        return;
      }

      const composed = await composeImage(base, overlay);
      window.ipcRenderer.send('save-screenshot-file', { ...payload, dataURL: composed });
    };
    run();
  }, [clampSelection, composeImage, exportOverlayDataUrl, exportSelectionDataUrl, selection]);

  const handlePin = useCallback(() => {
    const run = async () => {
      if (!selection) return;
      const bounds = clampSelection(selection);
      const payload = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };

      const hasEdits = !!actionRef.current?.hasEdits?.();
      let dataURL: string | null = null;
      if (hasEdits) {
        const base = await window.ipcRenderer.invoke('crop-screenshot-dataurl', payload);
        const overlay = exportOverlayDataUrl();
        if (base && overlay) {
          dataURL = await composeImage(base, overlay);
        } else {
          dataURL = exportSelectionDataUrl();
        }
      } else {
        dataURL = await window.ipcRenderer.invoke('crop-screenshot-dataurl', payload);
      }

      if (!dataURL) {
        dataURL = await window.ipcRenderer.invoke('crop-screenshot-dataurl', payload);
      }
      if (!dataURL) return;

      window.ipcRenderer.send('pin-image', {
        dataURL,
        bounds: payload,
      });
      window.ipcRenderer.send('close-screenshot');
    };
    run();
  }, [clampSelection, composeImage, exportOverlayDataUrl, exportSelectionDataUrl, selection]);

  const handleOCR = useCallback(async () => {
    if (!selection) return;

    const bounds = clampSelection(selection);
    const dataURL = await window.ipcRenderer.invoke('crop-screenshot-dataurl', {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
    if (!dataURL) return;

    setOcrPosition({
      x: Math.min(window.innerWidth - 380, bounds.x + bounds.width + 16),
      y: Math.max(10, bounds.y),
    });
    setShowOcrDialog(true);
    setOcrLoading(true);
    setOcrText('');

    try {
      const result = await recognizeText(dataURL);
      setOcrText(result.text || '');
    } catch {
      setOcrText('识别失败');
    } finally {
      setOcrLoading(false);
    }
  }, [clampSelection, exportSelectionDataUrl, selection]);

  const handleAction = useCallback((action: string) => {
    if (action === 'undo') return actionRef.current?.undo?.();
    if (action === 'redo') return actionRef.current?.redo?.();
    if (action === 'cancel') return handleCancel();
    if (action === 'confirm') return handleConfirm();
    if (action === 'ocr') return handleOCR();
    if (action === 'pin') return handlePin();
    if (action === 'save') return handleSaveFile();

    if (action.startsWith('color:')) {
      const color = action.slice('color:'.length);
      return actionRef.current?.setColor?.(color);
    }
    if (action.startsWith('size:')) {
      const size = Number(action.slice('size:'.length));
      if (!Number.isFinite(size)) return;
      return actionRef.current?.setSize?.(size);
    }
  }, [handleCancel, handleConfirm, handleOCR, handlePin, handleSaveFile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showOcrDialog) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const activeEl = document.activeElement as HTMLElement | null;
        const tag = activeEl?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || activeEl?.isContentEditable) return;
        e.preventDefault();
        actionRef.current?.deleteActiveObject?.();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
        return;
      }
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlOrCmd) return;

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          actionRef.current?.redo?.();
        } else {
          actionRef.current?.undo?.();
        }
        return;
      }
      if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        actionRef.current?.redo?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancel, handleConfirm, showOcrDialog]);

  if (!backgroundImage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50">
        <div className="text-white text-sm">加载截图中...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-transparent">
      <img
        src={backgroundImage}
        alt=""
        className="fixed inset-0 w-screen h-screen object-fill pointer-events-none select-none"
        draggable={false}
      />
      {showHint && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-zinc-900/70 text-zinc-100 text-xs backdrop-blur border border-white/10 shadow-lg flex items-center gap-2">
            <span>拖拽选择</span>
            <span className="text-zinc-400">·</span>
            <span>Enter 完成</span>
            <span className="text-zinc-400">·</span>
            <span>Esc 取消</span>
            <span className="text-zinc-400">·</span>
            <span>⌘/Ctrl+Z 撤销</span>
          </div>
        </div>
      )}

      <Canvas
        backgroundImage={backgroundImage}
        tool={tool}
        actionRef={actionRef}
        onHistoryChange={(u, r) => {
          setCanUndo(u);
          setCanRedo(r);
        }}
        onSelectionChange={(rect) => {
          setSelection(rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null);
        }}
      />

      <Toolbar
        activeTool={tool}
        canUndo={canUndo}
        canRedo={canRedo}
        position={toolbarPosition}
        onToolSelect={(id) => setTool(id)}
        onAction={handleAction}
      />

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

export default ScreenshotEditorPage;
