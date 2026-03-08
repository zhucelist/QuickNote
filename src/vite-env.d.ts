/// <reference types="vite/client" />
/// <reference types="vite-plugin-electron/electron-env" />
/// <reference types="vite-plugin-electron-renderer/electron-renderer-env" />

declare module 'react-screenshots' {
  import { CSSProperties } from 'react';

  export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface ScreenshotsProps {
    url: string;
    width?: number;
    height?: number;
    className?: string;
    style?: CSSProperties;
    onSave?: (blob: Blob, bounds: Bounds) => void;
    onCancel?: () => void;
    onOk?: (blob: Blob, bounds: Bounds) => void;
    lang?: {
      operation_rectangle_title: string;
      operation_ellipse_title: string;
      operation_arrow_title: string;
      operation_brush_title: string;
      operation_text_title: string;
      operation_mosaic_title: string;
      operation_undo_title: string;
      operation_redo_title: string;
      operation_ok_title: string;
      operation_cancel_title: string;
      operation_save_title: string;
    };
  }

  const Screenshots: React.FC<ScreenshotsProps>;
  export default Screenshots;
}
