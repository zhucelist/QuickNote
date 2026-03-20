import { BrowserWindow, ipcMain, desktopCapturer, screen, clipboard, nativeImage, app, shell, systemPreferences, dialog } from 'electron';
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
  private lastPermissionPromptAt = 0;

  constructor() {
    this.store = new Store({
      configName: 'settings',
      defaults: {}
    });
    this.setupIPC();
  }

  public async startScreenshot() {
    if (this.isCapturing) {
      console.log('[Screenshot] Already capturing, skipping...');
      return;
    }
    
    this.isCapturing = true;
    console.log('[Screenshot] Starting screenshot capture...');

    try {
      // 在 macOS 上，需要检查并请求屏幕录制权限
      if (process.platform === 'darwin') {
        const authStatus = systemPreferences.getMediaAccessStatus('screen');
        console.log('[Screenshot] macOS screen recording permission status:', authStatus);
        
        if (authStatus !== 'granted') {
          const now = Date.now();
          if (now - this.lastPermissionPromptAt < 2000) {
            this.isCapturing = false;
            return;
          }
          this.lastPermissionPromptAt = now;

          console.log('[Screenshot] Requesting screen recording permission...');
          showNotification(
            '需要屏幕录制权限',
            '快截笔记需要屏幕录制权限才能进行截图。请在系统偏好设置中授权。',
            () => {
              shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            }
          );

          try {
            const { response } = await dialog.showMessageBox({
              type: 'warning',
              buttons: ['打开系统设置', '取消'],
              defaultId: 0,
              cancelId: 1,
              message: '需要屏幕录制权限才能截图',
              detail: '请前往 系统设置 → 隐私与安全性 → 屏幕录制，开启对“快截笔记”（开发环境可能显示为“Electron”）的权限。开启后需要完全退出应用再重新打开。',
            });
            if (response === 0) {
              shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            }
          } catch {
          }

          this.isCapturing = false;
          return;
        }
      }

      // 获取所有屏幕
      const displays = screen.getAllDisplays();
      console.log(`[Screenshot] Found ${displays.length} displays`);

      const primaryDisplay = screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor || 1;
      const captureSize = {
        width: Math.round(primaryDisplay.size.width * scaleFactor),
        height: Math.round(primaryDisplay.size.height * scaleFactor),
      };

      // 获取所有屏幕的截图
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: captureSize,
      });

      if (!sources || sources.length === 0) {
        throw new Error('无法获取屏幕源');
      }

      // 找到主屏幕的 source
      const primarySource = sources.find(s => {
        // 尝试匹配屏幕 ID
        const display = displays.find(d => d.id.toString() === s.id.replace('screen:', ''));
        return display && display.id === primaryDisplay.id;
      }) || sources[0];

      if (!primarySource) {
        throw new Error('无法获取主屏幕源');
      }

      this.currentScreenshotDataUrl = primarySource.thumbnail.toDataURL();
      console.log('[Screenshot] Screenshot captured successfully');

      // 创建全屏窗口（DIP）
      this.createWindow(primaryDisplay.size.width, primaryDisplay.size.height, this.currentScreenshotDataUrl);

    } catch (error) {
      console.error('[Screenshot] Capture failed:', error);
      this.isCapturing = false;
      
      // 显示错误通知
      showNotification(
        '截图失败',
        error instanceof Error ? error.message : '未知错误',
        () => {}
      );
    }
  }

  private createWindow(width: number, height: number, screenshotDataUrl: string) {
    const preloadPath = path.join(process.env.APP_ROOT!, 'dist-electron', 'preload.cjs');

    const winOptions: Electron.BrowserWindowConstructorOptions = {
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
      fullscreen: false,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    };

    // Windows 平台特殊处理
    if (process.platform === 'win32') {
      winOptions.type = 'toolbar';
      winOptions.skipTaskbar = true;
    } else {
      // macOS
      winOptions.type = 'panel';
      winOptions.hiddenInMissionControl = true;
    }

    this.screenshotWindow = new BrowserWindow(winOptions);
    
    // 强制设置层级
    this.screenshotWindow.setAlwaysOnTop(true, 'screen-saver');
    this.screenshotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    this.screenshotWindow.setSize(width, height); 
    this.screenshotWindow.setPosition(0, 0);

    // 加载页面
    if (process.env.VITE_DEV_SERVER_URL) {
      this.screenshotWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#screenshot`);
    } else {
      this.screenshotWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'), {
        hash: 'screenshot'
      });
    }

    this.screenshotWindow.webContents.on('did-finish-load', () => {
      console.log('[Screenshot] Window loaded, sending data...');
      this.screenshotWindow?.webContents.send('screenshot-data', screenshotDataUrl);
      this.screenshotWindow?.show();
      this.screenshotWindow?.focus();
    });

    // 处理加载失败
    this.screenshotWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[Screenshot] Window failed to load:', errorCode, errorDescription);
      this.closeScreenshot();
    });

    this.screenshotWindow.on('closed', () => {
      console.log('[Screenshot] Window closed');
      this.screenshotWindow = null;
      this.isCapturing = false;
      this.currentScreenshotDataUrl = null;
    });
    
    this.screenshotWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'Escape') {
        this.closeScreenshot();
      }
    });

    // 处理窗口失去焦点（点击外部）
    this.screenshotWindow.on('blur', () => {
      // 可选：点击外部关闭截图窗口
      // this.closeScreenshot();
    });
  }

  public closeScreenshot() {
    if (this.screenshotWindow) {
      console.log('[Screenshot] Closing screenshot window...');
      this.screenshotWindow.close();
      this.screenshotWindow = null;
    }
    this.isCapturing = false;
    this.currentScreenshotDataUrl = null;
  }

  private setupIPC() {
    // 关闭截图
    ipcMain.on('close-screenshot', () => {
      this.closeScreenshot();
    });

    ipcMain.handle('crop-screenshot-dataurl', async (_event, data) => {
      const { x, y, width, height } = data || {};
      if (!this.currentScreenshotDataUrl || !width || !height) return null;
      try {
        const img = nativeImage.createFromDataURL(this.currentScreenshotDataUrl);
        const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
        const cropRect = {
          x: Math.round((x || 0) * scaleFactor),
          y: Math.round((y || 0) * scaleFactor),
          width: Math.round(width * scaleFactor),
          height: Math.round(height * scaleFactor)
        };
        const cropped = img.crop(cropRect);
        if (cropped.isEmpty()) return null;
        return cropped.toDataURL();
      } catch {
        return null;
      }
    });
    
    // 保存截图文件
    ipcMain.on('save-screenshot-file', async (_event, data) => {
      const { x, y, width, height, dataURL } = data || {};

      try {
        let image: Electron.NativeImage;

        if (dataURL) {
          image = nativeImage.createFromDataURL(dataURL);
        } else if (this.currentScreenshotDataUrl && width && height) {
          const img = nativeImage.createFromDataURL(this.currentScreenshotDataUrl);
          const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
          const cropRect = {
            x: Math.round((x || 0) * scaleFactor),
            y: Math.round((y || 0) * scaleFactor),
            width: Math.round(width * scaleFactor),
            height: Math.round(height * scaleFactor)
          };
          image = img.crop(cropRect);
        } else {
          throw new Error('缺少图片数据或选区信息');
        }
        
        if (image.isEmpty()) {
          throw new Error('生成的图片为空');
        }

        const screenshotConfig = this.store.get('screenshot') || {};
        
        // 默认路径: Pictures folder
        let saveDir = screenshotConfig.savePath;
        if (!saveDir) {
          saveDir = app.getPath('pictures');
        }

        // 生成文件名
        const fileNameTemplate = screenshotConfig.fileNameFormat || 'Screenshot_$yyyy-MM-dd_HH-mm-ss$.png';
        let fileName = generateFilename(fileNameTemplate, 'Screenshot');
        
        // 确保扩展名
        if (!path.extname(fileName)) {
          fileName += '.png';
        }

        const filePath = path.join(saveDir, fileName);
        
        // 确保目录存在
        if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }

        // 保存文件
        const pngBuffer = image.toPNG();
        await fs.promises.writeFile(filePath, pngBuffer);
        
        console.log('[Screenshot] Saved to:', filePath);
        showNotification(
          '截图已保存',
          `已保存到: ${filePath}`,
          () => {
            shell.showItemInFolder(filePath);
          }
        );

      } catch (error) {
        console.error('[Screenshot] Save failed:', error);
        showNotification(
          '保存失败',
          error instanceof Error ? error.message : '未知错误',
          () => {}
        );
      } finally {
        this.closeScreenshot();
      }
    });

    // 获取屏幕源 ID（用于多屏幕支持）
    ipcMain.handle('get-screen-source-id', async () => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        return sources[0]?.id || null;
      } catch (error) {
        console.error('[Screenshot] Failed to get screen source:', error);
        return null;
      }
    });

    // 保存截图到剪贴板
    ipcMain.on('save-screenshot', async (_event, data) => {
      const { x, y, width, height, dataURL } = data || {};
      
      if (!data) {
        this.closeScreenshot();
        return;
      }

      try {
        let imageToSave: Electron.NativeImage;

        if (dataURL) {
          // 使用提供的 data URL（包含绘制内容）
          imageToSave = nativeImage.createFromDataURL(dataURL);
        } else if (this.currentScreenshotDataUrl && width && height) {
          // 从原始截图裁剪
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
          throw new Error('缺少图片数据或选区信息');
        }
        
        if (imageToSave.isEmpty()) {
          throw new Error('生成的图片为空');
        }
        
        // 写入剪贴板
        clipboard.writeImage(imageToSave);
        console.log('[Screenshot] Copied to clipboard');
        
        // 显示通知
        showNotification(
          '截图已复制',
          '截图已保存到剪贴板',
          () => {}
        );
        
      } catch (error) {
        console.error('[Screenshot] Save to clipboard failed:', error);
        showNotification(
          '截图失败',
          error instanceof Error ? error.message : '未知错误',
          () => {}
        );
      }

      this.closeScreenshot();
    });
  }
  
  public destroy() {
    this.closeScreenshot();
    ipcMain.removeAllListeners('close-screenshot');
    ipcMain.removeAllListeners('save-screenshot');
    ipcMain.removeAllListeners('save-screenshot-file');
  }
}
