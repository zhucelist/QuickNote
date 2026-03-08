import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';

export class TrayManager {
  private tray: Tray | null = null;
  private window: BrowserWindow;
  private iconPath: string | null;

  constructor(window: BrowserWindow, iconPath: string) {
    this.window = window;
    this.iconPath = iconPath;
    this.createTray();
  }

  private createTray() {
    // 优先使用 Base64 图标以确保显示，因为 svg 在 windows 上支持不好
    // 这是一个简单的 16x16 黑色方块的 Base64，实际生产环境应该替换为真实的 PNG Base64
    const DEFAULT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZKAQMFKon2HgP+F/CqIxG8BwE8M//iMjI2NUQ8BoGKA9DNgcQAg30NAAAHgvBBshD1rkAAAAAElFTkSuQmCC';
    
    let icon = nativeImage.createFromDataURL(DEFAULT_ICON);
    
    // 如果 iconPath 是 PNG/ICO，尝试加载
    // 在开发模式下，iconPath 可能是 undefined 或者指向不正确的路径
    // 只有当文件确实存在时才使用
    try {
        if (this.iconPath && (this.iconPath.endsWith('.png') || this.iconPath.endsWith('.ico'))) {
            const fileIcon = nativeImage.createFromPath(this.iconPath);
            if (!fileIcon.isEmpty()) {
                icon = fileIcon;
                // macOS: 设置为 Template Image 以适应深色/浅色模式
                if (process.platform === 'darwin') {
                    icon.setTemplateImage(true);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load tray icon:', error);
    }
    
    this.tray = new Tray(icon);
    this.tray.setToolTip('快截笔记');

    this.updateContextMenu();

    this.tray.on('click', () => {
      this.toggleWindow();
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
        let img = nativeImage.createFromPath(path);
        if (!img.isEmpty()) {
          if (process.platform === 'darwin') img.setTemplateImage(true);
          this.tray.setImage(img);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to set tray icon:', e);
    }
    // fallback to default base64
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
      this.tray.setToolTip(`快截笔记 - ${count} 条记录`);
    }
    
    // 在 macOS 上更新 Dock Badge
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? count.toString() : '');
    }
  }

  private updateContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      { 
        label: '显示主窗口', 
        click: () => this.showWindow() 
      },
      { type: 'separator' },
      { 
        label: '退出', 
        click: () => {
          app.quit();
        } 
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private toggleWindow() {
    if (this.window.isVisible()) {
      this.window.hide();
    } else {
      this.showWindow();
    }
  }

  private showWindow() {
    this.window.show();
    this.window.focus();
  }

  public destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
