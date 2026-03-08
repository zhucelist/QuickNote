import { Menu, shell, MenuItemConstructorOptions, app } from 'electron';
import path from 'path';

export const createMenu = () => {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // ... (previous menu items)
    // App Menu (macOS only)
    ...(isMac
      ? [{
          label: '快截笔记',
          submenu: [
            { role: 'about', label: '关于 快截笔记' },
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
    // File
    {
      label: '文件',
      submenu: [
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ] as MenuItemConstructorOptions[]
    },
    // Edit
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
        { type: 'separator' },
        {
          label: '开始听写...',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
             // 占位，系统默认行为
          }
        },
        {
          label: '表情与符号',
          accelerator: 'Ctrl+Cmd+Space',
          role: 'startSpeaking' // 或者是 orderFrontCharacterPalette
        }
      ] as MenuItemConstructorOptions[]
    },
    // View
    {
      label: '视图',
      submenu: [
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
    // Window
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front', label: '前置全部窗口' },
              { type: 'separator' },
              { role: 'window', label: '窗口' }
            ]
          : [{ role: 'close', label: '关闭' }])
      ] as MenuItemConstructorOptions[]
    },
    // Help
    {
      role: 'help',
      label: '帮助',
      submenu: [
        {
          label: '了解更多',
          click: async () => {
            await shell.openExternal('https://electronjs.org');
          }
        },
        { type: 'separator' },
        {
          label: '打开日志目录',
          click: async () => {
             const logPath = path.join(app.getPath('userData'), 'logs');
             await shell.openPath(logPath);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
