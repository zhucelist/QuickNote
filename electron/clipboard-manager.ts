import { clipboard, ipcMain, BrowserWindow, nativeImage } from 'electron';
import { Store } from './store';
import { EventEmitter } from 'events';

export type ClipboardItem = {
  id: string;
  type: 'text' | 'image';
  content: string; // 文本内容或图片的 DataURL
  timestamp: number;
};

export class ClipboardManager extends EventEmitter {
  private store: Store;
  private history: ClipboardItem[] = [];
  private lastText: string = '';
  private lastImageDataUrl: string = '';
  private watcherInterval: NodeJS.Timeout | null = null;
  private window: BrowserWindow;

  private historyLimit: number = 50;

  constructor(window: BrowserWindow) {
    super();
    this.window = window;
    this.store = new Store({
      configName: 'clipboard-history',
      defaults: { history: [], limit: 50 },
    });
    
    // 加载历史记录
    const savedHistory = this.store.get('history');
    if (Array.isArray(savedHistory)) {
      this.history = savedHistory;
    }
    
    // 加载限制配置
    const savedLimit = this.store.get('limit');
    if (typeof savedLimit === 'number') {
      this.historyLimit = savedLimit;
    }

    this.setupIPC();
    this.startWatching();
  }

  private startWatching() {
    // 每 1 秒轮询一次
    this.watcherInterval = setInterval(() => {
      this.checkClipboard();
    }, 1000);
  }

  private checkClipboard() {
    // 1. 检查文本
    const text = clipboard.readText();
    // 过滤空文本
    if (text && text.trim().length > 0 && text !== this.lastText) {
      this.lastText = text;
      
      // 去重检查：如果最新的一条记录内容相同，则不添加
      if (this.history.length > 0 && this.history[0].type === 'text' && this.history[0].content === text) {
          return;
      }

      this.addHistoryItem({
        id: Date.now().toString(),
        type: 'text',
        content: text,
        timestamp: Date.now(),
      });
      return; // 优先处理文本变化
    }

    // 2. 检查图片
    // 从剪切板读取图片可能很昂贵，所以要小心。
    // electron.clipboard.readImage() 返回 NativeImage
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const dataUrl = image.toDataURL();
      // 过滤空图片 (data:image/png;base64, 这种可能是空的)
      if (dataUrl.length < 50) return; 

      if (dataUrl !== this.lastImageDataUrl) {
        this.lastImageDataUrl = dataUrl;
        
        // 去重检查
        if (this.history.length > 0 && this.history[0].type === 'image' && this.history[0].content === dataUrl) {
            return;
        }

        this.addHistoryItem({
          id: Date.now().toString(),
          type: 'image',
          content: dataUrl,
          timestamp: Date.now(),
        });
      }
    }
  }

  private addHistoryItem(item: ClipboardItem) {
    // 再次去重：检查历史记录中是否已经存在相同内容 (不仅仅是第一条)
    const existingIndex = this.history.findIndex(
      (historyItem) => historyItem.type === item.type && historyItem.content === item.content
    );

    if (existingIndex !== -1) {
      // 如果存在，移除旧的，以便将新的置顶
      this.history.splice(existingIndex, 1);
    }

    // 将新项添加到头部
    this.history.unshift(item);
    
    // 立即按时间倒序排序
    this.history.sort((a, b) => b.timestamp - a.timestamp);
    
    // 使用动态限制
    if (this.history.length > this.historyLimit) {
      this.history = this.history.slice(0, this.historyLimit);
    }

    // 持久化
    this.store.set('history', this.history);

    // 通知渲染进程
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('clipboard-update', this.history);
    }
    
    // 触发更新事件，供主进程使用
    this.emit('update', this.history.length);
  }

  private setupIPC() {
    // 处理获取历史记录请求
    ipcMain.handle('get-clipboard-history', () => {
      return this.history;
    });

    // 获取历史记录限制
    ipcMain.handle('get-history-limit', () => {
      return this.historyLimit;
    });

    // 设置历史记录限制
    ipcMain.handle('set-history-limit', (_event, limit: number) => {
      this.historyLimit = limit;
      this.store.set('limit', limit);
      // 如果当前历史记录超过新限制，进行裁剪
      if (this.history.length > limit) {
        this.history = this.history.slice(0, limit);
        this.store.set('history', this.history);
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('clipboard-update', this.history);
        }
      }
      return true;
    });

    // 处理复制项目请求（渲染进程请求写回剪切板）
    ipcMain.on('copy-item', (_event, item: ClipboardItem) => {
      if (item.type === 'text') {
        clipboard.writeText(item.content);
        this.lastText = item.content; // 更新 lastText 以避免重新触发观察者
      } else if (item.type === 'image') {
        const img = nativeImage.createFromDataURL(item.content);
        clipboard.writeImage(img);
        this.lastImageDataUrl = item.content;
      }
    });

    // 置顶功能已移除

    // 处理图片贴图请求
    ipcMain.on('pin-clipboard-image', (_event, item: ClipboardItem) => {
        if (!item.content) return;
        
        if (item.type === 'image') {
             ipcMain.emit('pin-image', _event, { dataURL: item.content });
        } else if (item.type === 'text') {
             ipcMain.emit('pin-text', _event, { text: item.content });
        }
    });

    // 处理清空历史记录
    ipcMain.on('clear-history', () => {
      this.history = [];
      this.store.set('history', []);
      // 同时清空系统剪切板，防止残留内容被重新识别为新记录
      clipboard.clear();
      // 重置最后一次记录的状态
      this.lastText = '';
      this.lastImageDataUrl = '';
      
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('clipboard-update', []);
      }
      
      // 触发更新事件
      this.emit('update', 0);
    });
  }

  public destroy() {
    if (this.watcherInterval) {
      clearInterval(this.watcherInterval);
    }
  }
}
