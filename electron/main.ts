import { app, BrowserWindow, nativeTheme, ipcMain, dialog, clipboard, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';

// Initialize logging
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'info';
autoUpdater.logger = log;

// Set log file path
const logPath = path.join(app.getPath('userData'), 'logs/app.log');
log.transports.file.resolvePathFn = () => logPath;

console.log('Log file path:', logPath);
log.info('Application starting...');
import { ClipboardManager } from './clipboard-manager'
import { ShortcutManager } from './shortcuts'
import { Store } from './store'
import { TrayManager } from './tray'
import { ScreenshotManager } from './screenshot-manager'
import { PinManager } from './pin-manager'
import { createMenu } from './menu'

// 禁用 GPU 加速，解决部分系统下的崩溃问题和透明窗口白屏问题
app.disableHardwareAcceleration();

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 使用 ['ENV_NAME'] 避免 vite:define 插件 - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let clipboardManager: ClipboardManager | null = null
let shortcutManager: ShortcutManager | null = null
let store: Store | null = null
let trayManager: TrayManager | null = null
let screenshotManager: ScreenshotManager | null = null
let pinManager: PinManager | null = null
let recorderManager: null = null
let isQuitting = false; // 标记是否正在退出应用

function createWindow() {
  // 初始化 Store
  store = new Store({
    configName: 'settings',
    defaults: { theme: 'system', autoLaunch: false, silentStart: false }
  });

  // 获取外观配置
  const appearanceConfig = store.get('appearance') || {};
  const { width = 800, height = 600 } = appearanceConfig.windowSize || {};
  const { resizable = true, maximizable = true, fullscreenable = false } = appearanceConfig;

  // 处理开机自启
  const autoLaunch = store.get('autoLaunch') || false;
  const silentStart = store.get('silentStart') || false;
  updateAutoLaunch(autoLaunch, silentStart);

  win = new BrowserWindow({
    width,
    height,
    resizable,
    maximizable,
    fullscreenable,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: true, // 明确允许 DevTools
      sandbox: false, // 关闭沙盒，解决 preload 加载与 file:// 协议本地资源访问问题
      contextIsolation: true, // 保持开启，使用 contextBridge
      webSecurity: true, // 保持开启，安全最佳实践
    },
    show: false, // 先隐藏，根据启动方式决定是否显示
  })
  
  // 临时：生产环境也打开 DevTools 方便排查白屏
  // if (!app.isPackaged) {
    // win.webContents.openDevTools();
  // }
  
  // 处理静默启动逻辑
  handleSilentStart();

  // 应用主题
  const theme = store.get('theme') || 'system';
  applyTheme(theme);

  // 创建应用菜单
  createMenu();

  // 初始化剪切板管理器
  clipboardManager = new ClipboardManager(win)
  // 监听剪切板更新事件，更新托盘信息
  clipboardManager.on('update', (count) => {
    trayManager?.updateStats(count);
  });

  // 初始化快捷键管理器
  shortcutManager = new ShortcutManager(win)
  shortcutManager.on('screenshot', () => {
    screenshotManager?.startScreenshot();
  });
  shortcutManager.on('pin', () => {
    // 读取剪切板内容并贴图
    const text = clipboard.readText();
    // readImage 返回 NativeImage，使用 isEmpty() 判断
    const image = clipboard.readImage();
    
    if (!image.isEmpty()) {
      // 优先图片
      pinManager?.createPinWindow({ type: 'image', content: image.toDataURL() });
    } else if (text && text.trim().length > 0) {
      // 其次文本
      pinManager?.createPinWindow({ type: 'text', content: text });
    }
  });

  // 初始化托盘管理器
  const iconPath = path.join(process.env.VITE_PUBLIC as string, 'electron-vite.svg');
  trayManager = new TrayManager(win, iconPath);
  
  // 初始化截图管理器
  screenshotManager = new ScreenshotManager();
  
  // 初始化贴图管理器
  pinManager = new PinManager();

  // 录屏功能已移除

  // 初始化时更新一次状态
  const initialCount = clipboardManager['history'].length;
  trayManager.updateStats(initialCount);

  // 拦截关闭事件
  win.on('close', (event) => {
    // 检查是否是从截图窗口或其他子窗口触发的关闭
    // 实际上 win.on('close') 只监听主窗口
    // 但如果用户 Cmd+Q 或调用 app.quit()，这里也会触发
    
    if (!isQuitting) {
      event.preventDefault();
      win?.hide();
      // 在 macOS 上，窗口隐藏时可以隐藏 Dock 图标（可选，取决于产品定义）
      // 但用户反馈希望在 Dock 中也能看到，所以保持显示
      // if (process.platform === 'darwin') {
      //   app.dock.hide(); 
      // }
      return false;
    }
    return true;
  });

  // 测试主动推送消息到渲染进程
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // 生产环境使用 loadFile 加载
    // 使用 app.getAppPath() 确保路径正确，不依赖 __dirname
    const appPath = app.getAppPath();
    const indexHtml = path.join(appPath, 'dist/index.html');
    
    log.info('应用路径 (appPath):', appPath);
    log.info('尝试加载 index.html:', indexHtml);
    
    // 生产环境必须使用 hash 模式的路径或确保路由正确
    // 如果是单页应用 (SPA)，直接加载 index.html
    win.loadFile(indexHtml).catch(e => {
        log.error('加载index.html失败:', e, '尝试路径:', indexHtml);
    });
  }
}

// 设置开机自启
function updateAutoLaunch(enabled: boolean, silent: boolean) {
  // macOS: openAtLogin, openAsHidden
  // Windows: openAtLogin, args
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: silent, // macOS
    args: silent ? ['--hidden'] : [] // Windows
  });
}

// 处理静默启动
function handleSilentStart() {
  if (!win) return;
  
  // 检查是否是静默启动
  const loginSettings = app.getLoginItemSettings();
  const isHiddenLaunch = process.argv.includes('--hidden') || loginSettings.wasOpenedAsHidden;
  
  // 如果配置了静默启动且确实是自启动触发的
  if (isHiddenLaunch) {
    win.hide();
  } else {
    win.show();
  }
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  nativeTheme.themeSource = theme;
}

// IPC 监听主题更改
ipcMain.handle('get-theme', () => {
  return store?.get('theme') || 'system';
});

ipcMain.handle('set-theme', (_event, theme: 'light' | 'dark' | 'system') => {
  store?.set('theme', theme);
  applyTheme(theme);
  return true;
});

// IPC 监听目录选择
ipcMain.handle('select-directory', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// IPC 选择文件（用于自定义托盘图标）
ipcMain.handle('select-file', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'ico'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC 获取截图配置
ipcMain.handle('get-screenshot-config', () => {
  return store?.get('screenshot') || { savePath: app.getPath('pictures') };
});

// IPC 保存截图配置
ipcMain.handle('set-screenshot-config', (_event, config) => {
  store?.set('screenshot', config);
  return true;
});

// IPC 获取贴图配置
ipcMain.handle('get-pin-config', () => {
  return store?.get('pin') || { opacity: 1, scale: 1 };
});

// IPC 保存贴图配置 - 已迁移至 PinManager 处理，此处删除以避免重复注册
/*
ipcMain.handle('set-pin-config', (_event, config) => {
  store?.set('pin', config);
  return true;
});
*/

// IPC 获取录屏配置
ipcMain.handle('get-recorder-config', () => {
  return { };
});

// IPC 保存录屏配置
ipcMain.handle('set-recorder-config', () => {
  return true;
});

// IPC 获取外观配置
ipcMain.handle('get-appearance-config', () => {
  return store?.get('appearance') || {
    theme: 'system',
    fontFamily: 'Helvetica Neue',
    themeColor: '#3b82f6',
    borderColor: '#3b82f6',
    maskColor: '#00000080',
    shadowColor: '#00000040',
    trayIcon: 'auto',
    borderWidth: 3,
    anchorType: 'all',
  };
});

// IPC 保存外观配置
ipcMain.handle('set-appearance-config', (_event, config) => {
  store?.set('appearance', config);
  
  if (win) {
    if (config.resizable !== undefined) win.setResizable(config.resizable);
    if (config.maximizable !== undefined) win.setMaximizable(config.maximizable);
    if (config.fullscreenable !== undefined) win.setFullScreenable(config.fullscreenable);
  }

  // 如果主题变化，立即应用
  if (config.theme) {
     applyTheme(config.theme);
  }

  // 托盘图标更新
  if (config.trayIcon) {
    if (config.trayIcon === 'hidden') {
      trayManager?.setVisible(false);
    } else {
      // 确保托盘存在
      if (!trayManager) {
        const iconPath = path.join(process.env.VITE_PUBLIC as string, 'electron-vite.svg');
        trayManager = new TrayManager(win as BrowserWindow, iconPath);
      }
      if (config.trayIcon === 'custom') {
        // 需要 trayIconPath
        if (config.trayIconPath) {
          trayManager.setIconPath(config.trayIconPath);
          trayManager.setVisible(true);
        }
      } else {
        // auto：还原默认图标
        const iconPath = path.join(process.env.VITE_PUBLIC as string, 'electron-vite.svg');
        trayManager.setIconPath(iconPath);
        trayManager.setVisible(true);
      }
    }
  }
  return true;
});

// IPC 调整窗口大小
ipcMain.on('resize-window', (_event, size: { width: number; height: number }) => {
  if (win) {
    win.setSize(size.width, size.height);
  }
});

// 在应用程序退出之前设置标志
app.on('before-quit', () => {
  isQuitting = true;
});

// 当所有窗口关闭时退出，macOS 除外。在 macOS 上，
// 应用程序及其菜单栏通常保持活动状态，直到用户使用 Cmd + Q 显式退出。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 即使在 Windows/Linux 上，我们也希望保持后台运行，除非显式退出
    // 所以这里不调用 app.quit()，除非 isQuitting 为 true
    if (isQuitting) {
       cleanup();
       app.quit();
    }
  }
})

function cleanup() {
  if (clipboardManager) {
    clipboardManager.destroy()
    clipboardManager = null
  }
  if (shortcutManager) {
    shortcutManager.destroy()
    shortcutManager = null
  }
  if (trayManager) {
    trayManager.destroy()
    trayManager = null
  }
  if (pinManager) {
      // pinManager.destroy() // if needed
      pinManager = null
  }
  if (recorderManager) {
    recorderManager = null;
  }
  win = null
}

app.on('activate', () => {
  // 在 macOS 上，当点击 dock 图标且没有其他窗口打开时，
  // 通常会在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (win) {
    win.show();
  }
})

app.whenReady().then(() => {
    // Explicitly set activation policy to regular to ensure Dock icon is visible
    if (process.platform === 'darwin') {
      app.setActivationPolicy('regular');
    }
  createWindow();
})

// IPC: 切换开机自启
ipcMain.handle('set-auto-launch', (_event, enabled: boolean) => {
  store?.set('autoLaunch', enabled);
  const silent = store?.get('silentStart') || false;
  updateAutoLaunch(enabled, silent);
  return true;
});

// IPC: 切换静默启动
ipcMain.handle('set-silent-start', (_event, enabled: boolean) => {
  store?.set('silentStart', enabled);
  const autoLaunch = store?.get('autoLaunch') || false;
  updateAutoLaunch(autoLaunch, enabled);
  return true;
});

// IPC: 获取启动设置
ipcMain.handle('get-startup-settings', () => {
  return {
    autoLaunch: store?.get('autoLaunch') || false,
    silentStart: store?.get('silentStart') || false
  };
});

// IPC: 检查更新
ipcMain.handle('check-for-update', () => {
  if (!app.isPackaged) {
    win?.webContents.send('update-message', '开发环境无法检查更新');
    return;
  }
  
  // 设置 feed URL（可选，如果 app-update.yml 配置正确则不需要）
  // autoUpdater.setFeedURL({
  //   provider: 'github',
  //   owner: 'zhucelist',
  //   repo: 'QuickNote'
  // });
  
  autoUpdater.checkForUpdates();
});

// IPC: 获取版本号
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC: 打开外部链接
ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(url);
});

// Auto Updater Events
autoUpdater.on('checking-for-update', () => {
  win?.webContents.send('update-message', '正在检查更新...');
});

autoUpdater.on('update-available', () => {
  win?.webContents.send('update-message', '发现新版本，正在下载...');
});

autoUpdater.on('update-not-available', () => {
  win?.webContents.send('update-message', '当前已是最新版本');
});

autoUpdater.on('error', (err) => {
  win?.webContents.send('update-message', '更新出错: ' + err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "下载速度: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - 已下载 ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  win?.webContents.send('update-message', `下载中... ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', () => {
  win?.webContents.send('update-message', '下载完成，重启应用以安装');
  // 可选：弹窗询问是否立即重启
  dialog.showMessageBox({
    type: 'info',
    title: '更新就绪',
    message: '新版本已下载，是否立即重启安装？',
    buttons: ['立即重启', '稍后']
  }).then((buttonIndex) => {
    if (buttonIndex.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// Global Error Handling
process.on('uncaughtException', (error) => {
    console.error('CRITICAL ERROR (Uncaught Exception):', error);
    log.error('CRITICAL ERROR (Uncaught Exception):', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR (Unhandled Rejection):', promise, 'reason:', reason);
    log.error('CRITICAL ERROR (Unhandled Rejection):', reason);
});

// Forward Renderer Logs to Terminal and Log File
ipcMain.on('renderer-console', (_event, level: string, ...args: any[]) => {
    const prefix = `[Renderer ${level.toUpperCase()}]`;
    
    // Log to file
    if (level === 'error') {
        log.error(prefix, ...args);
    } else if (level === 'warn') {
        log.warn(prefix, ...args);
    } else {
        log.info(prefix, ...args);
    }

    // Log to terminal
    if (level === 'error') {
        console.error(prefix, ...args);
    } else if (level === 'warn') {
        console.warn(prefix, ...args);
    } else {
        console.log(prefix, ...args);
    }
});

// Open Logs Folder
ipcMain.handle('open-logs-folder', () => {
    const logDir = path.dirname(log.transports.file.getFile().path);
    shell.openPath(logDir);
});
