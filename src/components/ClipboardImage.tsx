import { useEffect, useRef, useState } from 'react';

export const ClipboardImage = ({ dataUrl, maxWidth = 480, maxHeight = 240 }: { dataUrl: string; maxWidth?: number; maxHeight?: number }) => {
  const [url, setUrl] = useState<string | null>(null);
  const revokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const createThumb = () => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const w = Math.max(1, Math.floor(img.width * scale));
        const h = Math.max(1, Math.floor(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          const objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          revokeRef.current = () => URL.revokeObjectURL(objectUrl);
        }, 'image/png', 0.85);
      };
      img.src = dataUrl;
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(createThumb, { timeout: 300 });
    } else {
      setTimeout(createThumb, 0);
    }
    return () => {
      cancelled = true;
      revokeRef.current?.();
    };
  }, [dataUrl, maxWidth, maxHeight]);

  if (!url) {
    return <div className="w-[160px] h-[120px] bg-zinc-200/60 dark:bg-zinc-800/50 rounded animate-pulse" />;
  }
  return <img src={url} loading="lazy" alt="剪切板图片" className="max-h-40 max-w-full rounded object-contain" />;
};

