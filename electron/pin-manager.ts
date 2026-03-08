import { BrowserWindow, ipcMain, screen, nativeImage, Menu, dialog, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { Store } from './store';
import { generateFilename } from './utils/file-utils';
import { showNotification } from './utils/notification-utils';

export type PinContent = {
    type: 'image' | 'text' | 'html' | 'color';
    content: string; // dataURL, text content, html content, or hex color
};

export class PinManager {
  private pins: Set<BrowserWindow> = new Set();
  private pendingData: Map<number, PinContent> = new Map();
  private store: Store;

  constructor() {
    this.store = new Store({
        configName: 'settings',
        defaults: { pin: { opacity: 1, scale: 1 } }
    });
    this.registerIpc();
  }

  private registerIpc() {
    ipcMain.on('pin-image', (_event, { dataURL, bounds }) => {
      this.createPinWindow({ type: 'image', content: dataURL }, bounds);
    });

    ipcMain.on('pin-text', (_event, { text, bounds }) => {
        this.createPinWindow({ type: 'text', content: text }, bounds);
    });

    ipcMain.on('pin-ready', (event) => {
      if (event.sender.isDestroyed()) return;
      
      const webContentsId = event.sender.id;
      const data = this.pendingData.get(webContentsId);
      if (data) {
          event.sender.send('pin-data', data);
      }
      
      // Apply initial opacity
      const pinConfig = this.store.get('pin') || { opacity: 1 };
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
          win.setOpacity(pinConfig.opacity || 1);
      }
    });

    // Listen for opacity changes from settings
    ipcMain.handle('set-pin-config', (_event, config) => {
        this.store.set('pin', config);
        // Update all existing pin windows
        for (const win of this.pins) {
            if (!win.isDestroyed()) {
                win.setOpacity(config.opacity || 1);
            }
        }
        return true;
    });

    ipcMain.on('pin-context-menu', async (event) => {
        if (event.sender.isDestroyed()) return;
        let win: BrowserWindow | null = null;
        try {
            win = BrowserWindow.fromWebContents(event.sender);
        } catch (e) {
            console.error('Error getting window from webContents:', e);
            return;
        }
        
        if (!win || win.isDestroyed()) return;

        const data = this.pendingData.get(event.sender.id);
        
        const template: Electron.MenuItemConstructorOptions[] = [];

        if (data && data.type === 'image') {
            template.push({
                label: '保存图片',
                click: async () => {
                    if (!win || win.isDestroyed()) return;
                    
                    // Use global screenshot settings for default path and filename
                    const screenshotConfig = this.store.get('screenshot') || {};
                    let savePath = screenshotConfig.savePath || app.getPath('pictures');
                    const fileNameTemplate = screenshotConfig.fileNameFormat || 'Pin_$yyyy-MM-dd_HH-mm-ss$.png';
                    let defaultFileName = generateFilename(fileNameTemplate, 'Pin');
                    
                    // Ensure extension
                    if (!path.extname(defaultFileName)) {
                        defaultFileName += '.png';
                    }
                    
                    const { filePath } = await dialog.showSaveDialog(win, {
                        title: '保存图片',
                        defaultPath: path.join(savePath, defaultFileName),
                        filters: [{ name: 'Images', extensions: ['png', 'jpg'] }]
                    });

                    if (filePath) {
                        const img = nativeImage.createFromDataURL(data.content);
                        fs.writeFile(filePath, img.toPNG(), (err) => {
                            if (err) {
                                console.error('Failed to save image:', err);
                            } else {
                                showNotification(
                                    '贴图已保存',
                                    `已保存到: ${filePath}`,
                                    () => {
                                        shell.showItemInFolder(filePath);
                                    }
                                );
                            }
                        });
                    }
                }
            });
            template.push({ type: 'separator' });
        }

        template.push({
            label: '关闭',
            click: () => {
                if (win && !win.isDestroyed()) {
                    win.close();
                }
            }
        });

        const menu = Menu.buildFromTemplate(template);
        // Check window again before popup
        if (win && !win.isDestroyed()) {
            menu.popup({ window: win });
        }
    });

    ipcMain.on('close-pin', (event) => {
      if (event.sender.isDestroyed()) return;
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            win.close();
        }
      } catch (e) {
          console.error('Error closing pin window:', e);
      }
    });

    ipcMain.on('window-move', (event, { x, y }) => {
        if (event.sender.isDestroyed()) return;
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && !win.isDestroyed()) {
                const bounds = win.getBounds();
                win.setBounds({ 
                    x: Math.round(bounds.x + x), 
                    y: Math.round(bounds.y + y),
                    width: bounds.width,
                    height: bounds.height
                });
            }
        } catch (e) {
            console.error('Error moving pin window:', e);
        }
    });

    ipcMain.on('window-resize', (event, { scaleFactor }) => {
        if (event.sender.isDestroyed()) return;
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && !win.isDestroyed()) {
                const bounds = win.getBounds();
                const data = this.pendingData.get(event.sender.id);
                const padding = data && data.type === 'image' ? 0 : 30; // 与 createPinWindow 保持一致
                
                // Calculate content size
                const contentWidth = bounds.width - padding;
                const contentHeight = bounds.height - padding;

                // Determine display work area for clamping (top-left anchored)
                const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
                const wa = display.workArea;
                const maxWidthAvail = Math.max(50, wa.x + wa.width - bounds.x);
                const maxHeightAvail = Math.max(50, wa.y + wa.height - bounds.y);

                // Compute effective scale with clamping to screen
                let effScale = scaleFactor;
                if (scaleFactor > 1) {
                    const maxScaleW = (maxWidthAvail - padding) / contentWidth;
                    const maxScaleH = (maxHeightAvail - padding) / contentHeight;
                    const capScale = Math.min(maxScaleW, maxScaleH);
                    effScale = Math.min(scaleFactor, capScale);
                } else {
                    const minScaleW = 50 / contentWidth;
                    const minScaleH = 50 / contentHeight;
                    const minScale = Math.max(minScaleW, minScaleH);
                    effScale = Math.max(scaleFactor, minScale);
                }

                const newContentWidth = Math.round(contentWidth * effScale);
                const newContentHeight = Math.round(contentHeight * effScale);
                if (newContentWidth < 50 || newContentHeight < 50) return;

                const newWidth = newContentWidth + padding;
                const newHeight = newContentHeight + padding;

                win.setSize(newWidth, newHeight);
            }
        } catch (e) {
            console.error('Error resizing pin window:', e);
        }
    });

    ipcMain.on('window-set-size', (event, { width, height }) => {
        if (event.sender.isDestroyed()) return;
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && !win.isDestroyed()) {
                const bounds = win.getBounds();
                const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
                const wa = display.workArea;
                const maxWidthAvail = Math.max(50, wa.x + wa.width - bounds.x);
                const maxHeightAvail = Math.max(50, wa.y + wa.height - bounds.y);
                const clampedWidth = Math.min(Math.round(width), maxWidthAvail);
                const clampedHeight = Math.min(Math.round(height), maxHeightAvail);
                win.setSize(clampedWidth, clampedHeight);
            }
        } catch (e) {
            console.error('Error setting pin window size:', e);
        }
    });

    ipcMain.on('window-move-resize', (event, { x, y, width, height }) => {
        if (event.sender.isDestroyed()) return;
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && !win.isDestroyed()) {
                const display = screen.getDisplayNearestPoint({ x: x, y: y });
                const wa = display.workArea;
                const nx = Math.max(wa.x, Math.round(x));
                const ny = Math.max(wa.y, Math.round(y));
                const maxWidthAvail = wa.x + wa.width - nx;
                const maxHeightAvail = wa.y + wa.height - ny;
                const nw = Math.min(Math.round(width), Math.max(50, maxWidthAvail));
                const nh = Math.min(Math.round(height), Math.max(50, maxHeightAvail));
                win.setBounds({ x: nx, y: ny, width: nw, height: nh });
            }
        } catch (e) {
            console.error('Error moving/resizing pin window:', e);
        }
    });
  }

  public createPinWindow(data: PinContent, bounds?: { x: number, y: number, width: number, height: number }) {
    let winBounds = bounds;
    // 动态内边距：图片为 0，文本为 30（用于自定义阴影和安全留白）
    const padding = data.type === 'image' ? 0 : 30; 
    
    // Calculate size based on content if not provided
    if (!winBounds) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        
        let width = 400;
        let height = 300;
        
        if (data.type === 'image') {
            const img = nativeImage.createFromDataURL(data.content);
            const size = img.getSize();
            width = size.width;
            height = size.height;

            // Check if image is larger than screen (leave some margin)
            const maxW = screenWidth * 0.8;
            const maxH = screenHeight * 0.8;
            
            if (width > maxW || height > maxH) {
                const ratio = width / height;
                if (width / maxW > height / maxH) {
                    width = maxW;
                    height = width / ratio;
                } else {
                    height = maxH;
                    width = height * ratio;
                }
            }
        } else if (data.type === 'text') {
            // Estimate size based on text length
            const lines = data.content.split('\n');
            const maxLineLength = Math.max(...lines.map(line => line.length));
            
            // Rough estimation: 8px per char width, 20px per line height
            // Plus padding
            width = Math.min(Math.max(300, maxLineLength * 8 + 40), 800);
            height = Math.min(Math.max(200, lines.length * 20 + 40), 600);
        }
        
        // Add padding for shadow (仅文本等需要)
        if (padding > 0) {
            width += padding;
            height += padding;
        }
        
        winBounds = {
            x: Math.round((screenWidth - width) / 2),
            y: Math.round((screenHeight - height) / 2),
            width: width,
            height: height
        };
    } else {
        // 如果传入了内容边界：
        // - 图片：不需要额外 padding，保持原样
        // - 文本：需要为自定义阴影留白，并相应调整坐标
        if (padding === 0) {
            winBounds = { ...bounds! };
        } else {
            winBounds = {
                x: bounds!.x - 10,
                y: bounds!.y - 10,
                width: bounds!.width + padding,
                height: bounds!.height + padding
            };
        }
    }

    const win = new BrowserWindow({
      width: winBounds.width,
      height: winBounds.height,
      x: winBounds.x,
      y: winBounds.y,
      minWidth: 50,
      minHeight: 50,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000', // 确保透明背景
      alwaysOnTop: true,
      resizable: true, 
      hasShadow: false, // Disable system shadow to use custom CSS shadow
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(app.getAppPath(), 'dist-electron/preload.cjs'),
        backgroundThrottling: false,
      },
    });

    const webContentsId = win.webContents.id;
    this.pendingData.set(webContentsId, data);

    if (process.env.VITE_DEV_SERVER_URL) {
      win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#pin`);
    } else {
      win.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: 'pin' });
    }

    win.on('closed', () => {
      this.pins.delete(win);
      this.pendingData.delete(webContentsId);
    });

    this.pins.add(win);
  }
}
