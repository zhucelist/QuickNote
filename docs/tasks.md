# 开发任务列表 (Development Tasks)

## Phase 1: 项目初始化与基础架构
- [x] **Task 1.1**: 初始化项目结构 (Electron + Vite + React + TypeScript) <!-- id: 0 -->
- [x] **Task 1.2**: 配置 Electron 主进程 (Main Process) 与 渲染进程 (Renderer) 的构建流程 <!-- id: 1 -->
- [x] **Task 1.3**: 设置基础 IPC 通信 (Preload scripts) <!-- id: 2 -->
- [x] **Task 1.4**: 配置 Tailwind CSS <!-- id: 3 -->

## Phase 2: 剪切板核心功能
- [x] **Task 2.1**: 实现剪切板监听 (Clipboard Watcher) <!-- id: 4 -->
- [x] **Task 2.2**: 实现本地数据存储 (Local Storage / Lowdb) <!-- id: 5 -->
- [x] **Task 2.3**: 开发剪切板历史记录 UI (列表展示、搜索、类型图标) <!-- id: 6 -->
- [x] **Task 2.4**: 实现历史记录的点击复制与粘贴功能 <!-- id: 7 -->

## Phase 3: 快捷键与设置
- [x] **Task 3.1**: 实现全局快捷键注册模块 (Global Shortcuts) <!-- id: 8 -->
- [x] **Task 3.2**: 开发设置页面 (Settings Page) <!-- id: 9 -->
- [x] **Task 3.3**: 实现快捷键的用户自定义配置与持久化 <!-- id: 10 -->

## Phase 4: 截图与贴图功能 (重构与增强)
- [x] **Task 4.1**: 基础截图架构重构 (Transparent Window + State Management) <!-- id: 11 -->
- [ ] **Task 4.2**: 实现智能识别 (Smart Recognition) - 窗口/控件检测 <!-- id: 21 -->
- [x] **Task 4.3**: 实现图像标注系统 (Fabric.js/Konva集成, 矩形/椭圆) <!-- id: 12 -->
- [x] **Task 4.3.1**: 实现高级标注 (箭头、马赛克、文本、荧光笔、序号、聚光灯) <!-- id: 25 -->
- [ ] **Task 4.4**: 实现长截图/图像拼接 (Scrolling Screenshot) <!-- id: 22 -->
- [x] **Task 4.5**: 集成离线 OCR (Tesseract.js) <!-- id: 23 -->
- [x] **Task 4.6**: 实现动图录制 (GIF/WebP Generation) <!-- id: 24 -->
- [x] **Task 4.7**: 贴图功能优化 (Pin Image) - 独立窗口、缩放、置顶 <!-- id: 14 -->
- [x] **Task 4.8**: 截图输出 (Clipboard/File/Pin) <!-- id: 13 -->
- [x] **Task 4.9**: 设置页面参数管理 (截图/贴图设置) <!-- id: 26 -->

## Phase 5: 录屏功能
- [x] **Task 5.1**: 集成 desktopCapturer 获取屏幕源 <!-- id: 15 -->
- [x] **Task 5.2**: 实现录屏控制逻辑 (开始、暂停、停止) <!-- id: 16 -->
- [x] **Task 5.3**: 处理视频流与保存文件 (MediaRecorder) <!-- id: 17 -->

## Phase 6: 优化与发布
- [ ] **Task 6.1**: 性能优化 (虚拟列表渲染、内存管理) <!-- id: 18 -->
- [ ] **Task 6.2**: 应用打包配置 (electron-builder) <!-- id: 19 -->
- [ ] **Task 6.3**: 跨平台兼容性测试 (Windows/macOS) <!-- id: 20 -->
