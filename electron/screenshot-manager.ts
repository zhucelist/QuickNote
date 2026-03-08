import { BrowserWindow, ipcMain, desktopCapturer, screen, clipboard, nativeImage, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { Store } from './store';
import { generateFilename } from './utils/file-utils';
import { showNotification } from './utils/notification-utils';

export class ScreenshotManager {
  private screenshotWindow: BrowserWindow | null = null;
  private isCapturing = false;
  private currentScreenshotDataUrl: string | null = null;
  private store: Store;

  constructor() {
    this.store = new Store({
      configName: 'settings',
      defaults: {}
    });
    this.setupIPC();
  }

  public async startScreenshot() {
    if (this.isCapturing) return;
    this.isCapturing = true;

    // 获取主屏幕尺寸
    // 注意：这里仅处理主屏幕，多屏幕支持需要更复杂的逻辑
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    
    // 为了支持高 DPI (Retina)，需要考虑 scaleFactor
    // thumbnailSize 应该设为 物理像素大小
    const scaledWidth = width * primaryDisplay.scaleFactor;
    const scaledHeight = height * primaryDisplay.scaleFactor;

    try {
      // 获取屏幕截图
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: scaledWidth, height: scaledHeight },
      });

      // 找到主屏幕的 source
      const primarySource = sources[0];

      if (!primarySource) {
        console.error('无法获取屏幕源');
        this.isCapturing = false;
        return;
      }

      this.currentScreenshotDataUrl = primarySource.thumbnail.toDataURL();

      // 创建全屏窗口
      this.createWindow(width, height, this.currentScreenshotDataUrl);

    } catch (error) {
      console.error('截图失败:', error);
      this.isCapturing = false;
    }
  }

  // ... (createWindow method remains mostly same, just update currentScreenshotDataUrl usage if needed)
  private createWindow(width: number, height: number, screenshotDataUrl: string) {
    const preloadPath = path.join(process.env.APP_ROOT!, 'dist-electron', 'preload.mjs');

    this.screenshotWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      enableLargerThanScreen: true,
      hasShadow: false,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });

    const url = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}#screenshot`
      : `file://${path.join(process.env.APP_ROOT!, 'dist/index.html')}#screenshot`;

    this.screenshotWindow.loadURL(url);

    this.screenshotWindow.webContents.on('did-finish-load', () => {
      this.screenshotWindow?.webContents.send('screenshot-data', screenshotDataUrl);
      this.screenshotWindow?.show();
      this.screenshotWindow?.focus();
    });

    this.screenshotWindow.on('closed', () => {
      this.screenshotWindow = null;
      this.isCapturing = false;
      this.currentScreenshotDataUrl = null;
    });
    
    this.screenshotWindow.webContents.on('before-input-event', (_event, input) => {
        if (input.key === 'Escape') {
            this.closeScreenshot();
        }
    });
  }

  public closeScreenshot() {
    if (this.screenshotWindow) {
      this.screenshotWindow.close();
      this.screenshotWindow = null;
    }
    this.isCapturing = false;
    this.currentScreenshotDataUrl = null;
  }

  private setupIPC() {
    ipcMain.on('close-screenshot', () => {
      this.closeScreenshot();
    });
    
    ipcMain.on('save-screenshot-file', async (_event, data) => {
        const { dataURL } = data || {};
        if (!dataURL) return;

        try {
            const image = nativeImage.createFromDataURL(dataURL);
            const screenshotConfig = this.store.get('screenshot') || {};
            
            // Default path: Pictures folder
            let saveDir = screenshotConfig.savePath;
            if (!saveDir) {
                saveDir = app.getPath('pictures');
            }

            // Generate filename
            const fileNameTemplate = screenshotConfig.fileNameFormat || 'Screenshot_$yyyy-MM-dd_HH-mm-ss$.png';
            let fileName = generateFilename(fileNameTemplate, 'Screenshot');
            
            // Ensure extension
            if (!path.extname(fileName)) {
                fileName += '.png';
            }

            const filePath = path.join(saveDir, fileName);
            
            // Ensure directory exists
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }

            fs.writeFile(filePath, image.toPNG(), (err) => {
                if (err) {
                    console.error('Failed to save screenshot:', err);
                } else {
                    console.log('Screenshot saved to:', filePath);
                    showNotification(
                        '截图已保存',
                        `已保存到: ${filePath}`,
                        () => {
                            shell.showItemInFolder(filePath);
                        }
                    );
                }
            });

        } catch (error) {
            console.error('Error saving screenshot file:', error);
        }
    });

    ipcMain.handle('get-screen-source-id', async () => {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        // Return the first screen (primary)
        return sources[0]?.id;
    });

    // Save Recording (This should be in RecorderManager, but left here for compatibility if needed)
    ipcMain.on('save-recording', async () => {
        // ... (Logic moved to RecorderManager)
    });

    ipcMain.on('save-screenshot', async (_event, data) => {
        // data contains selection {x, y, width, height} and optional dataURL
        const { x, y, width, height, dataURL } = data || {};
        
        if (!data) {
            this.closeScreenshot();
            return;
        }

        try {
            let imageToSave: Electron.NativeImage;

            if (dataURL) {
                // Use the provided data URL (includes drawings)
                imageToSave = nativeImage.createFromDataURL(dataURL);
            } else if (this.currentScreenshotDataUrl && width && height) {
                // Fallback: Crop from original screenshot
                const img = nativeImage.createFromDataURL(this.currentScreenshotDataUrl);
                const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
                
                const cropRect = {
                    x: Math.round(x * scaleFactor),
                    y: Math.round(y * scaleFactor),
                    width: Math.round(width * scaleFactor),
                    height: Math.round(height * scaleFactor)
                };
                imageToSave = img.crop(cropRect);
            } else {
                console.error('无法保存: 缺少图片数据或选区信息');
                this.closeScreenshot();
                return;
            }
            
            // 2. 写入剪切板
            if (!imageToSave.isEmpty()) {
                clipboard.writeImage(imageToSave);
            }
            
            // 3. (已移除) 完成操作仅写入剪切板，不再自动保存文件
            // 如需保存文件，请使用“保存”按钮触发 save-screenshot-file
            
        } catch (error) {
            console.error('保存截图出错:', error);
        }

        this.closeScreenshot();
    });
  }
  
  public destroy() {
      this.closeScreenshot();
      ipcMain.removeAllListeners('close-screenshot');
      ipcMain.removeAllListeners('save-screenshot');
  }
}
