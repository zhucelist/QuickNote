import { app, Tray, Menu, nativeImage, BrowserWindow, Notification } from 'electron';

export class TrayManager {
  private tray: Tray | null = null;
  private window: BrowserWindow;
  private iconPath: string | null;
  private onScreenshot?: () => void;
  private onPin?: () => void;
  private onSearch?: () => void;
  private isRunningInBackground = false;

  constructor(
    window: BrowserWindow, 
    iconPath: string,
    callbacks?: {
      onScreenshot?: () => void;
      onPin?: () => void;
      onSearch?: () => void;
    }
  ) {
    this.window = window;
    this.iconPath = iconPath;
    this.onScreenshot = callbacks?.onScreenshot;
    this.onPin = callbacks?.onPin;
    this.onSearch = callbacks?.onSearch;
    this.createTray();
    this.setupWindowListeners();
  }

  private createTray() {
    // 优先使用 Base64 图标以确保显示
    const DEFAULT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZKAQMFKon2HgP+F/CqIxG8BwE8M//iMjI2NUQ8BoGKA9DNgcQAg30NAAAHgvBBshD1rkAAAAAElFTkSuQmCC';
    
    let icon = nativeImage.createFromDataURL(DEFAULT_ICON);
    if (process.platform === 'darwin') {
        icon.setTemplateImage(true);
    }
    
    try {
        if (this.iconPath && (this.iconPath.endsWith('.png') || this.iconPath.endsWith('.ico'))) {
            const fileIcon = nativeImage.createFromPath(this.iconPath);
            if (!fileIcon.isEmpty()) {
                icon = fileIcon;
                if (process.platform === 'darwin') {
                    icon.setTemplateImage(true);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load tray icon:', error);
    }
    
    this.tray = new Tray(icon);
    this.tray.setToolTip('快截笔记 - 正在后台运行');

    this.updateContextMenu();

    // 左键点击托盘图标 - 切换窗口显示/隐藏
    this.tray.on('click', () => {
      this.toggleWindow();
    });

    // 右键点击托盘图标 - 显示上下文菜单
    this.tray.on('right-click', () => {
      this.tray?.popUpContextMenu();
    });
  }

  // 设置窗口监听器
  private setupWindowListeners() {
    // 监听窗口显示事件
    this.window.on('show', () => {
      this.isRunningInBackground = false;
      this.updateContextMenu();
    });

    // 监听窗口隐藏事件
    this.window.on('hide', () => {
      this.isRunningInBackground = true;
      this.updateContextMenu();
    });
  }

  public setIconPath(path: string | null) {
    this.iconPath = path;
    if (!this.tray) {
      this.createTray();
      return;
    }
    try {
      if (path && (path.endsWith('.png') || path.endsWith('.ico'))) {
        const img = nativeImage.createFromPath(path);
        if (!img.isEmpty()) {
          if (process.platform === 'darwin') img.setTemplateImage(true);
          this.tray.setImage(img);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to set tray icon:', e);
    }
    const DEFAULT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZKAQMFKon2HgP+F/CqIxG8BwE8M//iMjI2NUQ8BoGKA9DNgcQAg30NAAAHgvBBshD1rkAAAAAElFTkSuQmCC';
    this.tray.setImage(nativeImage.createFromDataURL(DEFAULT_ICON));
  }

  public setVisible(visible: boolean) {
    if (visible) {
      if (!this.tray) this.createTray();
    } else {
      this.destroy();
    }
  }

  public updateStats(count: number) {
    if (this.tray) {
      const status = this.isRunningInBackground ? '正在后台运行' : '前台运行中';
      this.tray.setToolTip(`快截笔记 - ${count} 条记录 - ${status}`);
    }
    
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? count.toString() : '');
    }
  }

  // 显示托盘通知
  public showNotification(title: string, body: string) {
    // 使用系统通知
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: this.iconPath || undefined,
        silent: true,
      });
      notification.show();
      
      // 点击通知时显示窗口
      notification.on('click', () => {
        this.showWindow();
      });
    }
  }

  private updateContextMenu() {
    if (!this.tray) return;

    const isVisible = this.window.isVisible();
    const isMinimized = this.window.isMinimized();

    const contextMenu = Menu.buildFromTemplate([
      { 
        label: isVisible && !isMinimized ? '隐藏主窗口' : '显示主窗口', 
        click: () => this.toggleWindow() 
      },
      { type: 'separator' },
      ...(this.onScreenshot ? [{
        label: '截图',
        accelerator: process.platform === 'darwin' ? 'Option+A' : 'Alt+Shift+A',
        click: () => this.onScreenshot!()
      }] : []),
      ...(this.onPin ? [{
        label: '贴图',
        accelerator: process.platform === 'darwin' ? 'Option+P' : 'Alt+P',
        click: () => this.onPin!()
      }] : []),
      ...(this.onSearch ? [{
        label: '搜索',
        accelerator: 'Ctrl+Q',
        click: () => this.onSearch!()
      }] : []),
      { type: 'separator' },
      {
        label: '后台运行状态',
        enabled: false,
        toolTip: '应用当前正在后台运行，快捷键仍然有效'
      },
      { type: 'separator' },
      { 
        label: '完全退出', 
        click: () => {
          // 通过 IPC 通知主进程退出
          app.quit();
        } 
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private toggleWindow() {
    if (this.window.isVisible() && !this.window.isMinimized()) {
      this.window.hide();
      this.isRunningInBackground = true;
    } else {
      this.showWindow();
      this.isRunningInBackground = false;
    }
    this.updateContextMenu();
  }

  private showWindow() {
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    this.window.show();
    if (this.window.isMinimized()) {
      this.window.restore();
    }
    this.window.focus();
    this.isRunningInBackground = false;
    this.updateContextMenu();
  }

  public destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
