# 跨平台剪切板工具设计文档

## 1. 项目概述
本项目旨在开发一款跨平台的剪切板增强工具，支持 Windows、macOS 和 Linux。
核心功能包括剪切板历史记录管理、自定义快捷键、屏幕截图、贴图（图片置顶显示）以及屏幕录制。

## 2. 技术栈选择
为了确保跨平台兼容性和开发效率，我们采用以下技术栈：
- **框架**: [Electron](https://www.electronjs.org/) (基于 Chromium 和 Node.js)
- **前端框架**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/) (快速 UI 开发)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **数据存储**: [Lowdb](https://github.com/typicode/lowdb) (本地 JSON 存储) 或 SQLite

## 3. 功能模块设计

### 3.1 剪切板管理 (Clipboard Manager)
- **监听**: 实时监听系统剪切板变化。
- **存储**: 保存文本、图片、HTML、RTF 等格式的历史记录。
- **展示**: 提供列表视图，支持搜索、过滤、预览。
- **操作**: 
  - 点击条目复制到当前剪切板。
  - 双击条目直接粘贴（模拟粘贴操作）。
  - 删除、清空历史记录。

### 3.2 快捷键系统 (Global Shortcuts)
- **配置**: 用户可在设置界面自定义功能的全局快捷键。
- **默认键位**:
  - 唤起剪切板面板: `Alt + V` (Windows) / `Option + V` (macOS)
  - 截图: `Alt + A` / `Option + A`
  - 贴图: `Alt + P` / `Option + P` (将剪切板最新图片贴在屏幕上)

### 3.3 截图功能 (Screenshot)
- **详见**: [截图功能详细设计文档](./screenshot-design.md)
- **智能识别**: 自动识别窗口、控件，支持滚轮切换父子元素。
- **图像拼接**: 滚动截屏，自动拼接长图。
- **离线OCR**: 内置 OCR 引擎，本地提取文字。
- **动图生成**: 区域录制，生成 GIF/WebP。
- **图像标注**: 矩形、椭圆、箭头、序号、荧光笔、马赛克、文字水印等，支持撤销/重做。
- **输出**: 复制到剪切板、保存到文件、钉在桌面上（贴图）。

### 3.4 贴图功能 (Pin Image)
- **原理**: 创建无边框、总是置顶 (Always on Top) 的独立窗口显示图片。
- **交互**:
  - 拖拽移动位置。
  - 滚轮缩放大小。
  - 右键菜单：复制、保存、关闭、调整透明度。

### 3.5 录屏功能 (Screen Recording)
- **源选择**: 选择全屏、特定窗口或选定区域。
- **录制**: 支持包含系统音频/麦克风。
- **控制**: 开始、暂停、停止。
- **输出**: 保存为 MP4/WebM 格式。

## 4. 架构设计

### 4.1 进程模型
- **主进程 (Main Process)**:
  - 管理应用生命周期。
  - 注册全局快捷键。
  - 访问原生 API (剪切板监听、屏幕捕获、文件系统)。
  - 管理多窗口（主窗口、截图窗口、贴图窗口）。
- **渲染进程 (Renderer Process)**:
  - UI 展示 (React)。
  - 与主进程通过 `IPC` (Inter-Process Communication) 通信。

### 4.2 目录结构
```
/
├── src/
│   ├── main/             # 主进程代码
│   │   ├── index.ts      # 入口
│   │   ├── clipboard.ts  # 剪切板监听逻辑
│   │   ├── shortcuts.ts  # 快捷键管理
│   │   └── windows/      # 窗口管理
│   ├── preload/          # 预加载脚本 (IPC桥接)
│   ├── renderer/         # 渲染进程 (React)
│   │   ├── components/   # UI 组件
│   │   ├── pages/        # 页面 (历史记录、设置、截图遮罩等)
│   │   └── store/        # 状态管理
│   └── shared/           # 共享类型定义
├── electron-builder.yml  # 打包配置
└── package.json
```

## 5. 开发路线图 (Roadmap)

1.  **初始化项目**: 搭建 Electron + Vite + React + TypeScript 环境。
2.  **核心架构**: 实现主进程与渲染进程的基础 IPC 通信。
3.  **剪切板功能**: 实现监听、存储、读取、写入。
4.  **UI 开发**: 剪切板列表页、设置页。
5.  **快捷键模块**: 实现全局快捷键注册与用户配置持久化。
6.  **截图与贴图**: 开发截图窗口、工具栏及贴图窗口逻辑。
7.  **录屏功能**: 集成 `desktopCapturer` 和 `MediaRecorder`。
8.  **优化与打包**: 性能优化、跨平台打包测试。
