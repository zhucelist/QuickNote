import React, { useRef, useState, useEffect } from 'react';
import clsx from 'clsx';

interface ZoomableContainerProps {
  children: React.ReactNode;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  className?: string;
  onScaleChange?: (scale: number) => void;
  enableDrag?: boolean;
}

export const ZoomableContainer: React.FC<ZoomableContainerProps> = ({
  children,
  initialScale = 1,
  minScale = 0.1,
  maxScale = 5,
  className,
  onScaleChange,
  enableDrag = false
}) => {
  const [scale, setScale] = useState(initialScale);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Ctrl/Cmd + Wheel to zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => {
          const newScale = Math.max(minScale, Math.min(maxScale, prev + delta));
          onScaleChange?.(newScale);
          return newScale;
        });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [minScale, maxScale, onScaleChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableDrag) return;
    // Only drag with left mouse button
    if (e.button !== 0) return;
    
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastPositionRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !enableDrag) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    setPosition({
      x: lastPositionRef.current.x + dx,
      y: lastPositionRef.current.y + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      ref={containerRef}
      className={clsx("overflow-hidden relative w-full h-full", className)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: enableDrag ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
    >
      <div 
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
};
