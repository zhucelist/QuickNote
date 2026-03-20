import { BrowserWindow, ipcMain, shell, app, screen, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { FlexSearchIndexer, SearchItem } from './flex-search-indexer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SearchManager {
  private searchWindow: BrowserWindow | null = null;
  private indexer: FlexSearchIndexer;
  private iconCache = new Map<string, string>();

  constructor() {
    this.indexer = new FlexSearchIndexer();
    this.createSearchWindow();
    this.registerIpcHandlers();
    
    // 清除图标缓存，确保重新获取
    console.log('[SearchManager] Clearing icon cache on startup');
    this.iconCache.clear();
  }

  private createSearchWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.searchWindow = new BrowserWindow({
      width: 800,
      height: 600,
      x: Math.round(primaryDisplay.bounds.x + (width - 800) / 2),
      y: Math.round(primaryDisplay.bounds.y + height * 0.2),
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      show: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      this.searchWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#search`);
    } else {
      this.searchWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'), {
        hash: 'search'
      });
    }

    this.searchWindow.on('blur', () => {
      this.hide();
    });
  }

  public show() {
    if (!this.searchWindow || this.searchWindow.isDestroyed()) {
      this.createSearchWindow();
      this.searchWindow?.webContents.once('did-finish-load', () => {
        this.searchWindow?.show();
        this.searchWindow?.focus();
        this.searchWindow?.webContents.send('search-reset');
      });
    } else {
      this.searchWindow.show();
      this.searchWindow.focus();
      setTimeout(() => {
        if (this.searchWindow && !this.searchWindow.isDestroyed()) {
          this.searchWindow.webContents.send('search-reset');
        }
      }, 50);
    }
  }

  public hide() {
    this.searchWindow?.hide();
  }

  public toggle() {
    if (this.searchWindow && !this.searchWindow.isDestroyed() && this.searchWindow.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  private registerIpcHandlers() {
    // FlexSearch 搜索
    ipcMain.handle('perform-search', async (_, query: string) => {
      const startTime = Date.now();
      const results = await this.indexer.search(query, 'all');
      console.log(`[Search] Query: "${query}" found ${results.length} results in ${Date.now() - startTime}ms`);
      
      // 转换结果格式并添加图标
      const enriched = await this.enrichResults(results);
      return enriched;
    });

    ipcMain.handle('open-search-item', async (_, itemPath: string) => {
      try {
        await shell.openPath(itemPath);
        this.hide();
      } catch (error) {
        console.error('Failed to open item:', error);
      }
    });

    ipcMain.handle('hide-search', () => {
      this.hide();
    });

    ipcMain.on('search-item-context-menu', (_, payload: { path: string; type: 'app' | 'file' | 'folder' }) => {
      this.showSearchItemContextMenu(payload?.path, payload?.type);
    });
  }

  private showSearchItemContextMenu(itemPath: string, itemType: 'app' | 'file' | 'folder') {
    if (!itemPath) return;
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '打开',
        click: () => {
          shell.openPath(itemPath);
        }
      },
      {
        label: '打开目录',
        click: () => {
          if (itemType === 'folder') {
            shell.openPath(itemPath);
            return;
          }
          shell.showItemInFolder(itemPath);
        }
      }
    ];
    if (itemType === 'file' || itemType === 'folder') {
      template.push(
        { type: 'separator' },
        {
          label: '删除',
          click: () => {
            void (async () => {
              try {
                await shell.trashItem(itemPath);
                this.searchWindow?.webContents.send('search-item-deleted', itemPath);
              } catch (error) {
                console.error('Delete search item failed:', error);
              }
            })();
          }
        }
      );
    }
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: this.searchWindow || undefined });
  }

  // 丰富搜索结果，添加预览信息和图标
  private async enrichResults(items: SearchItem[]): Promise<any[]> {
    const enriched = [];
    
    for (const item of items) {
      let preview = '';
      let icon: string | undefined;
      
      if (item.type === 'app') {
        preview = '应用程序';
      } else if (item.type === 'folder') {
        preview = '文件夹';
      } else {
        const ext = item.ext || path.extname(item.name).slice(1).toUpperCase() || '文件';
        // 尝试获取文件内容预览
        const contentPreview = await this.getFileContentPreview(item.path, item.ext);
        preview = contentPreview || ext;
      }
      
      // 同步获取图标
      try {
        icon = await this.getIconForItem(item.path, item.type);
      } catch {
        // 忽略图标获取失败
      }
      
      enriched.push({
        id: item.path,
        name: item.name,
        path: item.path,
        type: item.type,
        preview,
        icon
      });
    }
    
    return enriched;
  }

  // 获取文件内容预览
  private async getFileContentPreview(filePath: string, ext?: string): Promise<string | null> {
    // 支持的文本文件扩展名
    const textExts = [
      'txt', 'md', 'markdown', 'mdown', 'mkd', 'mkdn',
      'js', 'jsx', 'ts', 'tsx', 'json', 'json5', 'jsonc',
      'py', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx',
      'go', 'rs', 'rb', 'php', 'swift', 'kt', 'kts',
      'html', 'htm', 'css', 'scss', 'sass', 'less',
      'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config',
      'sql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
      'vue', 'svelte', 'astro', 'tex', 'text',
      'log', 'diff', 'patch', 'csv'
    ];
    
    if (!ext || !textExts.includes(ext.toLowerCase())) {
      return null;
    }
    
    try {
      // 只读取前 200 个字符作为预览
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) { // 大于 10MB 不预览
        return '文件过大';
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 3); // 前 3 行
      let preview = lines.join(' ').trim();
      
      // 截断并清理
      if (preview.length > 100) {
        preview = preview.substring(0, 100) + '...';
      }
      
      // 移除多余空白
      preview = preview.replace(/\s+/g, ' ').trim();
      
      return preview || null;
    } catch {
      return null;
    }
  }

  // 获取文件/应用图标 - 使用 macOS 原生方法
  private async getIconForItem(itemPath: string, type: string): Promise<string | undefined> {
    // 检查缓存
    const cached = this.iconCache.get(itemPath);
    if (cached) {
      return cached;
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(itemPath)) {
      return undefined;
    }
    
    try {
      let dataUrl: string | undefined;
      
      if (type === 'app' && itemPath.endsWith('.app')) {
        // 使用 macOS sips 命令提取应用图标
        dataUrl = await this.getMacAppIcon(itemPath);
      } else {
        // 对于文件，使用 Electron 的 getFileIcon
        dataUrl = await this.getFileIconElectron(itemPath, type);
      }
      
      if (dataUrl) {
        // 限制缓存大小
        if (this.iconCache.size > 1000) {
          const keysToDelete = Array.from(this.iconCache.keys()).slice(0, 100);
          keysToDelete.forEach(key => this.iconCache.delete(key));
        }
        this.iconCache.set(itemPath, dataUrl);
      }
      
      return dataUrl;
    } catch (error) {
      console.log(`[Icon] Failed to get icon for ${itemPath}:`, error);
      return undefined;
    }
  }
  
  // 使用 macOS sips 命令获取应用图标
  private async getMacAppIcon(appPath: string): Promise<string | undefined> {
    try {
      // 找到应用图标文件
      const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
      if (!fs.existsSync(infoPlistPath)) {
        return undefined;
      }
      
      // 读取 Info.plist 获取图标名称
      const plistContent = fs.readFileSync(infoPlistPath, 'utf-8');
      const iconFileMatch = plistContent.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/);
      
      if (!iconFileMatch) {
        return undefined;
      }
      
      let iconName = iconFileMatch[1];
      // 添加 .icns 扩展名（如果没有）
      if (!iconName.endsWith('.icns')) {
        iconName += '.icns';
      }
      
      const iconPath = path.join(appPath, 'Contents', 'Resources', iconName);
      if (!fs.existsSync(iconPath)) {
        return undefined;
      }
      
      // 使用 sips 转换为 PNG
      const tempPngPath = path.join(app.getPath('temp'), `icon_${Date.now()}.png`);
      const command = `sips -s format png "${iconPath}" --out "${tempPngPath}" 2>/dev/null`;
      
      await new Promise<void>((resolve, reject) => {
        exec(command, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      if (!fs.existsSync(tempPngPath)) {
        return undefined;
      }
      
      // 读取 PNG 文件并转换为 data URL
      const pngBuffer = fs.readFileSync(tempPngPath);
      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      
      // 删除临时文件
      try {
        fs.unlinkSync(tempPngPath);
      } catch {}
      
      return dataUrl;
    } catch (error) {
      console.log(`[Icon] sips failed for ${appPath}:`, error);
      return undefined;
    }
  }
  
  // 使用 Electron 获取文件图标
  private async getFileIconElectron(itemPath: string, type: string): Promise<string | undefined> {
    try {
      const preferredSize = type === 'app' ? 'large' : 'normal';
      const icon = await app.getFileIcon(itemPath, { size: preferredSize as 'small' | 'normal' | 'large' });
      
      if (!icon || icon.isEmpty()) {
        return undefined;
      }
      
      const png = icon.toPNG();
      if (!png || png.length === 0) {
        return undefined;
      }
      
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      return undefined;
    }
  }
}
