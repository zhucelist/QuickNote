# QuickNote

一款现代化的、功能强大的桌面端生产力工具，集成了**剪切板管理**、**屏幕截图**、**离线 OCR** 与**桌面贴图**功能。基于 Electron + React 构建，专为提升 Mac/Windows 用户效率设计。

![App Screenshot](https://via.placeholder.com/800x450?text=QuickNote+Screenshot) <!-- 建议替换为实际截图 -->

## ✨ 核心功能

### 📋 剪切板增强
- **历史记录**：自动记录复制的文本与图片，支持无限滚动查看。
- **高效搜索**：支持关键字高亮搜索，快速定位历史内容。
- **代码高亮**：自动识别代码片段并进行语法高亮展示。
- **即时贴图**：一键将剪切板内容（文本/图片）转化为桌面贴图。

### 📸 截图与标注
- **区域截图**：精准捕捉屏幕任意区域，支持多显示器环境。
- **专业标注**：内置矩形、圆形、箭头、荧光笔、序号标签、马赛克模糊等绘图工具。
- **离线 OCR**：基于 Tesseract.js 实现本地离线文字识别，无需联网，保护隐私。
- **自定义外观**：支持自定义选区边框颜色、宽度及锚点样式。

### 📌 桌面贴图 (Pin)
- **置顶显示**：将重要的图片或文本“钉”在屏幕最上层，参考资料随手可得。
- **交互控制**：支持滚轮缩放、双击缩小/关闭、透明度调节。
- **智能边界**：贴图自动吸附屏幕边缘，防止移出视野。
- **无边框模式**：图片贴图自动移除边框，完美融合桌面背景。

### ⚙️ 个性化设置
- **主题定制**：完美适配系统深色/浅色模式，支持自定义主题色。
- **快捷键管理**：全功能全局快捷键支持，内置冲突检测与录制功能。
- **系统集成**：支持开机自启、静默启动、自定义托盘图标。
- **自动更新**：集成自动更新功能，时刻保持最新版本。

## 🚀 下载与安装

[前往 Releases 页面下载最新版本](#) <!-- 请替换为实际 Release 链接 -->

支持 **macOS** (Intel/Apple Silicon) 与 **Windows**。

## ⌨️ 默认快捷键

| 功能 | macOS | Windows |
| --- | --- | --- |
| **打开主面板** | `Option + V` | `Alt + V` |
| **屏幕截图** | `Option + A` | `Alt + A` |
| **剪切板贴图** | `Option + P` | `Alt + P` |

*注：所有快捷键均可在设置中根据习惯进行自定义。*

## 🛠️ 本地开发

如果你想参与开发或自行构建：

```bash
# 1. 克隆项目
git clone https://github.com/zhucelist/QuickNote.git
cd QuickNote

# 2. 安装依赖
npm install

# 3. 启动开发环境 (同时启动 Electron 主进程与 React 渲染进程)
npm run dev

# 4. 构建安装包
# 构建所有平台
npm run build
# 仅构建 macOS
npm run build:mac
# 仅构建 Windows
npm run build:win
```

## 📦 技术栈

- **核心框架**: [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **UI 样式**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) (图标)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **图形处理**: [Fabric.js](http://fabricjs.com/) (标注绘图), [Tesseract.js](https://tesseract.projectnaptha.com/) (OCR)
- **数据存储**: [electron-store](https://github.com/sindresorhus/electron-store)
- **构建工具**: [electron-builder](https://www.electron.build/)

## 📄 License

[MIT](./LICENSE) © 2026 QuickNote Team, [Zhuceelist](https://github.com/zhucelist)
