import { Menu, shell, MenuItemConstructorOptions, app } from 'electron';
import path from 'path';

// 菜单栏事件发射器
export const menuEvents = {
  onScreenshot: () => {},
  onPin: () => {},
  onSearch: () => {},
  onSettings: () => {},
};

export const createMenu = () => {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App Menu (macOS only)
    ...(isMac
      ? [{
          label: '快截笔记',
          submenu: [
            { role: 'about', label: '关于 快截笔记' },
            { type: 'separator' },
            {
              label: '偏好设置...',
              accelerator: 'Cmd+,',
              click: () => menuEvents.onSettings()
            },
            { type: 'separator' },
            { role: 'services', label: '服务' },
            { type: 'separator' },
            { role: 'hide', label: '隐藏 快截笔记' },
            { role: 'hideOthers', label: '隐藏其他' },
            { role: 'unhide', label: '显示全部' },
            { type: 'separator' },
            { role: 'quit', label: '退出 快截笔记' }
          ]
        } as MenuItemConstructorOptions]
      : []),
    
    // 文件菜单
    {
      label: '文件',
      submenu: [
        {
          label: '截图',
          accelerator: isMac ? 'Option+A' : 'Alt+Shift+A',
          click: () => menuEvents.onScreenshot()
        },
        {
          label: '贴图',
          accelerator: isMac ? 'Option+P' : 'Alt+P',
          click: () => menuEvents.onPin()
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ] as MenuItemConstructorOptions[]
    },
    
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
        { role: 'delete', label: '删除' },
        { role: 'selectAll', label: '全选' },
        ...(isMac ? [
          { type: 'separator' as const },
          {
            label: '开始听写...',
            accelerator: 'CmdOrCtrl+D',
            click: () => {}
          },
          {
            label: '表情与符号',
            accelerator: 'Ctrl+Cmd+Space',
            role: 'startSpeaking' as const
          }
        ] : [])
      ] as MenuItemConstructorOptions[]
    },
    
    // 视图菜单
    {
      label: '视图',
      submenu: [
        {
          label: '搜索',
          accelerator: 'Ctrl+Q',
          click: () => menuEvents.onSearch()
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '切换开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    
    // 截图菜单
    {
      label: '截图',
      submenu: [
        {
          label: '开始截图',
          accelerator: isMac ? 'Option+A' : 'Alt+Shift+A',
          click: () => menuEvents.onScreenshot()
        },
        {
          label: '贴图',
          accelerator: isMac ? 'Option+P' : 'Alt+P',
          click: () => menuEvents.onPin()
        },
        { type: 'separator' },
        {
          label: '截图设置...',
          click: () => menuEvents.onSettings()
        }
      ]
    },
    
    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front', label: '前置全部窗口' },
              { type: 'separator' as const },
              { role: 'window', label: '窗口' }
            ]
          : [{ role: 'close', label: '关闭' }])
      ] as MenuItemConstructorOptions[]
    },
    
    // 帮助菜单
    {
      role: 'help',
      label: '帮助',
      submenu: [
        {
          label: '快捷键说明',
          click: () => {
            // TODO: 显示快捷键帮助窗口
          }
        },
        {
          label: '使用指南',
          click: async () => {
            await shell.openExternal('https://github.com/your-repo/quicknote#readme');
          }
        },
        { type: 'separator' },
        {
          label: '检查更新',
          click: () => {
            // TODO: 检查更新
          }
        },
        { type: 'separator' },
        {
          label: '打开日志目录',
          click: async () => {
             const logPath = path.join(app.getPath('userData'), 'logs');
             await shell.openPath(logPath);
          }
        },
        { type: 'separator' },
        {
          label: '关于 快截笔记',
          click: () => {
            // TODO: 显示关于对话框
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  return menu;
};
