import { globalShortcut, ipcMain, BrowserWindow } from 'electron';
import { Store } from './store';
import { EventEmitter } from 'events';

interface ShortcutConfig {
  showClipboard: string;
  screenshot: string;
  pin: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  showClipboard: process.platform === 'darwin' ? 'Option+V' : 'Alt+V',
  screenshot: process.platform === 'darwin' ? 'Option+A' : 'Alt+A',
  pin: process.platform === 'darwin' ? 'Option+P' : 'Alt+P',
};

export class ShortcutManager extends EventEmitter {
  private store: Store;
  private config: ShortcutConfig;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    super();
    this.window = window;
    this.store = new Store({
      configName: 'settings',
      defaults: { shortcuts: DEFAULT_SHORTCUTS },
    });
    
    const savedConfig = this.store.get('shortcuts');
    // 合并默认配置，确保新添加的快捷键有默认值
    this.config = { ...DEFAULT_SHORTCUTS, ...savedConfig };

    // 将合并结果回写到磁盘，保证配置文件中有 shortcuts 字段
    this.store.set('shortcuts', this.config);

    this.registerShortcuts();
    this.setupIPC();
  }

  private registerShortcuts() {
    globalShortcut.unregisterAll();

    // 显示剪切板
    this.register(this.config.showClipboard, () => {
      if (this.window && !this.window.isDestroyed()) {
        if (this.window.isVisible() && this.window.isFocused()) {
          this.window.hide();
        } else {
          this.window.show();
          this.window.focus();
          // 切换到剪切板标签页
          this.window.webContents.send('switch-tab', 'clipboard');
        }
      }
    });

    // 截图
    this.register(this.config.screenshot, () => {
      this.emit('screenshot');
    });

    // 贴图
    this.register(this.config.pin, () => {
      this.emit('pin');
    });
  }

  private register(accelerator: string, callback: () => void) {
    try {
      if (accelerator && accelerator.trim() !== '') {
        // 先检查是否被注册
        if (globalShortcut.isRegistered(accelerator)) {
            console.warn(`快捷键 ${accelerator} 已被其他应用占用`);
            // 这里我们选择不注册，并可以通过某种方式通知前端（如果需要）
            // 但 globalShortcut.register 返回 false 也会涵盖这种情况
            // 显式检查可以提供更明确的日志
        }

        const ret = globalShortcut.register(accelerator, callback);
        if (!ret) {
          console.warn('快捷键注册失败:', accelerator);
        }
      }
    } catch (error) {
      console.error('快捷键注册出错:', accelerator, error);
    }
  }

  private setupIPC() {
    ipcMain.handle('get-shortcuts', () => {
      return this.config;
    });

    ipcMain.handle('update-shortcut', (_event, key: keyof ShortcutConfig, accelerator: string) => {
      // 检查冲突
      if (globalShortcut.isRegistered(accelerator)) {
         // 注意：isRegistered 会返回 true 如果是我们自己注册的。
         // 但 update-shortcut 通常是设置新值，新值如果已注册说明冲突（除非新值和旧值一样，那不需要更新）
         if (this.config[key] !== accelerator) {
             console.warn(`快捷键 ${accelerator} 已被占用`);
             return false; // 返回失败
         }
      }

      const oldAccelerator = this.config[key];
      this.config[key] = accelerator;
      
      // 尝试注册新快捷键
      try {
        // 先注销旧的（如果是全局重新注册逻辑，这一步可能由 registerShortcuts 覆盖）
        // 但为了原子性测试，我们可以先试着注册一下
        // 这里采用整体重新注册策略
        this.store.set('shortcuts', this.config);
        this.registerShortcuts();
        
        // 验证是否注册成功
        if (globalShortcut.isRegistered(accelerator)) {
            return true;
        } else {
            // 回滚
            console.warn(`快捷键 ${accelerator} 注册失败，回滚`);
            this.config[key] = oldAccelerator;
            this.store.set('shortcuts', this.config);
            this.registerShortcuts();
            return false;
        }
      } catch (e) {
          console.error('更新快捷键异常', e);
          return false;
      }
    });
    
    // 新增：检查快捷键是否可用 IPC
    ipcMain.handle('check-shortcut-available', (_event, accelerator: string) => {
        return !globalShortcut.isRegistered(accelerator);
    });
  }


  public destroy() {
    globalShortcut.unregisterAll();
  }
}
