import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

export type PinContent = {
    type: 'image' | 'text' | 'html' | 'color';
    content: string; 
};

export const PinPage: React.FC = () => {
  const [pinData, setPinData] = useState<PinContent | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'se' | 'sw' | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, windowX: 0, windowY: 0 });
  const imgAspectRatio = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [renderMode, setRenderMode] = useState<'markdown' | 'code'>('markdown');
  const [detectedLang, setDetectedLang] = useState('text');

  useEffect(() => {
    // Make background transparent
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    // Check system theme
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    
    const themeHandler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', themeHandler);

    const handleData = (_event: unknown, data: PinContent) => {
      setPinData(data);
      if (data.type === 'text') {
          // Heuristic: If text looks like code (has indentation, special chars, but no markdown headers/lists)
          // render as code block to preserve formatting exactly.
          const lang = detectLanguage(data.content);
          setDetectedLang(lang);
          
          // Simple heuristic: if detected language is a programming language (not text/markdown)
          // and it doesn't look like a markdown document (no # headers), treat as raw code
          const isMarkdown = /^\s*#|\*{2,}|\[.*\]\(.*\)/m.test(data.content);
          
          if (lang !== 'text' && !isMarkdown) {
              setRenderMode('code');
          } else {
              setRenderMode('markdown');
          }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClose();
        }
    };

    window.ipcRenderer.on('pin-data', handleData);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove as any);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Signal that we are ready
    window.ipcRenderer.send('pin-ready');

    return () => {
      window.ipcRenderer.off('pin-data', handleData);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove as any);
      window.removeEventListener('mouseup', handleMouseUp);
      darkModeQuery.removeEventListener('change', themeHandler);
    };
  }, [isDragging, isResizing, pinData]); // Add dependencies for event listeners to capture latest state

  const detectLanguage = (code: string): string => {
      if (code.trim().startsWith('<') && code.includes('>')) return 'xml';
      if (code.includes('import ') || code.includes('export ') || code.includes('const ') || code.includes('function ') || code.includes('=>')) return 'javascript';
      if (code.includes('def ') || code.includes('class ') || (code.includes('import ') && !code.includes(';'))) return 'python';
      if (code.includes('#include') || code.includes('int main')) return 'cpp';
      if (code.includes('package ') || code.includes('public class')) return 'java';
      if (code.trim().startsWith('{') || code.trim().startsWith('[')) return 'json';
      return 'text';
  };

  const handleClose = () => {
      window.ipcRenderer.send('close-pin');
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (pinData?.type !== 'image') return;
      
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      window.ipcRenderer.send('window-resize', { scaleFactor: factor });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (pinData?.type !== 'image' || e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY }; // Use client coordinates for initial point
  };

  const handleResizeMouseDown = (e: React.MouseEvent, direction: 'se' | 'sw') => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeDirection(direction);
      resizeStartRef.current = { 
          x: e.screenX, 
          y: e.screenY, 
          width: window.outerWidth, 
          height: window.outerHeight,
          windowX: window.screenX,
          windowY: window.screenY
      };
  };

  const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
          e.preventDefault();
          if (pinData?.type === 'image') {
              if (e.movementX !== 0 || e.movementY !== 0) {
                  window.ipcRenderer.send('window-move', { x: e.movementX, y: e.movementY });
              }
          }
      }

      if (isResizing && resizeDirection) {
          e.preventDefault();
          const deltaX = e.screenX - resizeStartRef.current.x;
          // const deltaY = e.screenY - resizeStartRef.current.y; // Not used for constrained resize
          
          let newWidth = resizeStartRef.current.width;
          let newHeight = resizeStartRef.current.height;
          let newX = resizeStartRef.current.windowX;
          let newY = resizeStartRef.current.windowY;

          const padding = pinData?.type === 'image' ? 0 : 30; // 图片不需要内边距

          if (resizeDirection === 'se') {
              // Right-bottom resize
              newWidth = resizeStartRef.current.width + deltaX;
              if (newWidth < 50 + padding) newWidth = 50 + padding; // Min size check
              
              if (pinData?.type === 'image' && imgAspectRatio.current > 0) {
                  // Constrain height based on width to keep aspect ratio
                  const contentWidth = newWidth - padding;
                  const contentHeight = contentWidth / imgAspectRatio.current;
                  newHeight = Math.round(contentHeight + padding);
              } else {
                  // Free resize for text or if no ratio
                  newHeight = resizeStartRef.current.height + (e.screenY - resizeStartRef.current.y);
              }

              window.ipcRenderer.send('window-set-size', {
                  width: newWidth,
                  height: newHeight
              });
          } else if (resizeDirection === 'sw') {
              // Left-bottom resize
              // Dragging left (negative delta) increases width
              newWidth = resizeStartRef.current.width - deltaX;
              if (newWidth < 50 + padding) {
                  newWidth = 50 + padding;
                  // Adjust deltaX to match min width constraint
                  // deltaX = startWidth - newWidth
              }

              if (pinData?.type === 'image' && imgAspectRatio.current > 0) {
                  const contentWidth = newWidth - padding;
                  const contentHeight = contentWidth / imgAspectRatio.current;
                  newHeight = Math.round(contentHeight + padding);
              } else {
                  // Free resize
                   newHeight = resizeStartRef.current.height + (e.screenY - resizeStartRef.current.y);
              }

              // X position changes by deltaX (if not constrained)
              // But we should recalculate X based on width change to be precise
              // newX = startX - (newWidth - startWidth)
              newX = resizeStartRef.current.windowX - (newWidth - resizeStartRef.current.width);

              window.ipcRenderer.send('window-move-resize', {
                  x: newX,
                  y: newY,
                  width: newWidth,
                  height: newHeight
              });
          }
      }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
          imgAspectRatio.current = img.naturalWidth / img.naturalHeight;
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      window.ipcRenderer.send('pin-context-menu');
  };

  if (!pinData) return null;

  return (
    <div className={clsx(
      "w-screen h-screen flex flex-col overflow-hidden bg-transparent group relative",
      pinData?.type === 'image' ? "p-0" : "p-[15px]"
    )}>
      
      <div className="flex-1 w-full h-full overflow-hidden relative shadow-[0_0_15px_rgba(59,130,246,0.8)] bg-transparent rounded-lg box-border"
           onContextMenu={handleContextMenu}>
        {pinData.type === 'image' ? (
             <>
                <div 
                    className="w-full h-full flex items-center justify-center cursor-move bg-transparent"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                >
                    <img 
                        ref={imgRef}
                        src={pinData.content} 
                        alt="Pinned" 
                        className="pointer-events-none select-none w-full h-full object-contain"
                        draggable={false}
                        onLoad={handleImageLoad}
                    />
                </div>
                {/* Resize Handle SE */}
                <div 
                    className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-zinc-400 dark:text-zinc-500">
                        <path d="M10 0 L10 10 L0 10 Z" fill="currentColor" />
                    </svg>
                </div>
                {/* Resize Handle SW */}
                <div 
                    className="absolute bottom-0 left-0 w-6 h-6 cursor-nesw-resize z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-zinc-400 dark:text-zinc-500 transform rotate-90">
                        <path d="M10 0 L10 10 L0 10 Z" fill="currentColor" />
                    </svg>
                </div>
             </>
        ) : pinData.type === 'text' ? (
             <div className={clsx(
                    "w-full h-full flex flex-col overflow-hidden relative",
                    isDarkMode ? "bg-zinc-900 text-white" : "bg-white text-black"
                  )}>
                 {/* Drag Handle */}
                 <div className="h-5 w-full shrink-0 cursor-move hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center group/handle" 
                      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                      title="按住拖动">
                     <div className="w-8 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 group-hover/handle:bg-zinc-400 dark:group-hover/handle:bg-zinc-500 transition-colors" />
                 </div>

                 <div className="flex-1 p-2 overflow-auto select-text font-mono border-none prose dark:prose-invert max-w-none"
                      style={{ 
                          fontSize: '14px', 
                          lineHeight: '1.6', 
                          wordBreak: 'break-all', 
                          whiteSpace: 'pre-wrap', 
                          overflowX: 'hidden' 
                      } as React.CSSProperties}>
                 {renderMode === 'code' ? (
                     <SyntaxHighlighter
                        language={detectedLang}
                        style={isDarkMode ? vscDarkPlus : vs}
                        customStyle={{ background: 'transparent', margin: 0, padding: 0 }}
                        wrapLines={true}
                        wrapLongLines={true}
                     >
                        {pinData.content}
                     </SyntaxHighlighter>
                 ) : (
                     <ReactMarkdown
                        remarkPlugins={[remarkBreaks, remarkGfm]}
                        components={{
                            code({node, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match && !String(children).includes('\n');
                                
                                if (isInline) {
                                    return (
                                        <code className={clsx("px-1 py-0.5 rounded text-sm font-mono", isDarkMode ? "bg-zinc-800 text-yellow-300" : "bg-gray-100 text-red-500")} {...props}>
                                            {children}
                                        </code>
                                    );
                                }

                                return (
                                    <SyntaxHighlighter
                                        style={isDarkMode ? vscDarkPlus : vs}
                                        language={match ? match[1] : ''} // Default to auto/none if no language
                                        PreTag="div"
                                        customStyle={{ background: 'transparent', margin: 0, padding: '0.5em' }}
                                        {...props as any}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                );
                            }
                        }}
                     >
                        {pinData.content}
                     </ReactMarkdown>
                 )}
                 </div>
                 
                 {/* Resize Handle */}
                 <div 
                    className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                 >
                     <svg width="10" height="10" viewBox="0 0 10 10" className="text-zinc-400 dark:text-zinc-500">
                         <path d="M10 0 L10 10 L0 10 Z" fill="currentColor" />
                     </svg>
                 </div>
             </div>
        ) : (
            <div className="w-full h-full bg-white dark:bg-zinc-900 flex items-center justify-center text-red-500">
                Unsupported Type
            </div>
        )}
      </div>
    </div>
  );
};
