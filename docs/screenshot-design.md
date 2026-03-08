# 截图功能详细设计文档 (Screenshot Module Design)

## 1. 概述
基于 PixPin 的功能参考，本项目将实现一个高性能、功能丰富的截图工具。核心目标是提供流畅的截图体验，支持智能识别、长截图、离线 OCR、动图录制以及强大的标注功能。

## 2. 核心功能与技术方案

### 2.1 智能识别 (Smart Recognition)
*   **功能描述**: 自动检测鼠标下的窗口、控件或 UI 元素边界。支持通过滚轮或快捷键在父子元素间切换选择范围。
*   **技术实现**:
    *   **方案 A (轻量级)**: 使用 OpenCV.js 对 `desktopCapturer` 获取的截图进行边缘检测 (Canny Edge Detection) 和轮廓分析，计算闭合区域。
    *   **方案 B (原生级)**: 开发或引入 Node.js C++ 插件 (Native Addon) 调用系统 API (如 Windows UI Automation, macOS Accessibility API) 获取窗口和控件的坐标信息。
    *   **选择**: 初期采用 **方案 A** 进行图像级分析，若精度不足再考虑原生插件。

### 2.2 图像拼接 (Image Stitching / Long Screenshot)
*   **功能描述**: 支持滚动截屏，自动拼接网页、聊天记录等长内容。
*   **技术实现**:
    *   用户选择滚动区域。
    *   模拟鼠标滚轮滚动 (Node.js `nut.js` 或 `robotjs`)。
    *   连续捕获屏幕截图。
    *   使用图像特征匹配算法 (SIFT/SURF 或简单的像素行对比) 寻找重叠区域并拼接。
    *   **库**: `opencv-wasm` 或自定义 Canvas 像素比对算法。

### 2.3 离线 OCR (Offline OCR)
*   **功能描述**: 本地提取截图中的文字，无需联网。
*   **技术实现**:
    *   集成 **Tesseract.js** (基于 WebAssembly 的 Tesseract OCR 引擎)。
    *   或者集成 **PearOCR** 的离线模型 (如果开源可用)，否则使用 Tesseract 作为替代。
    *   **流程**: 截图 -> 选区 -> 转换为灰度/二值化 -> Tesseract 识别 -> 输出文本。

### 2.4 动图生成 (GIF/WebP Generation)
*   **功能描述**: 录制选定区域的操作，生成 GIF 或 WebP 动图。
*   **技术实现**:
    *   使用 `desktopCapturer` 获取屏幕流 (`chromeMediaSource: 'desktop'`)。
    *   裁剪流画面到选定区域。
    *   使用 **gif.js** (纯 JS) 或 **ffmpeg.wasm** (更强大) 将帧序列编码为 GIF/WebP。
    *   支持简单的帧编辑（删除帧、调整延时）。

### 2.5 图像标注 (Image Annotation)
*   **功能描述**: 提供丰富的绘图工具，支持二次编辑、撤销/重做。
*   **工具列表**:
    *   基础: 矩形、椭圆、直线、箭头。
    *   高级: 序列号 (自动递增)、荧光笔 (半透明)、马赛克 (高斯模糊/像素化)、聚光灯 (背景压暗)。
    *   文字: 带背景/描边的文本输入。
    *   水印: 自定义图片/文字水印。
*   **技术实现**:
    *   使用 **Fabric.js** 或 **Konva.js** 作为绘图引擎。
    *   每个标注对象都是独立的 Layer，可选中、移动、修改属性。
    *   实现 Command Pattern (命令模式) 以支持 Undo/Redo 栈。

## 3. 架构设计

### 3.1 窗口管理
*   **ScreenshotWindow**: 一个全屏、无边框、透明 (`transparent: true`)、总是置顶 (`alwaysOnTop: true`) 的 BrowserWindow。
*   **生命周期**:
    1.  用户触发截图快捷键。
    2.  主进程捕获当前屏幕 (全屏截图) 并缓存。
    3.  显示 ScreenshotWindow，将全屏截图作为背景绘制。
    4.  用户进行交互 (选区、标注)。
    5.  完成/取消后隐藏窗口并清理资源。

### 3.2 状态管理 (Zustand)
*   `status`: 'idle' | 'selecting' | 'editing' | 'recording'
*   `selection`: { x, y, width, height }
*   `history`: Array<AnnotationAction> (用于撤销重做)
*   `tool`: 'rect' | 'arrow' | 'text' | ...
*   `toolSettings`: { color, strokeWidth, fontSize, ... }

### 3.3 交互流程
1.  **激活**: 快捷键 (Alt+A) -> 主进程截屏 -> 打开覆盖层。
2.  **选区**:
    *   鼠标移动: 高亮显示智能识别的区域 (如有)。
    *   鼠标拖拽: 手动创建选区。
    *   调整: 拖动选区边缘手柄调整大小。
3.  **工具栏**: 选区确定后，在选区下方/上方悬浮显示工具栏。
4.  **操作**: 点击工具栏图标 -> 切换 canvas 交互模式 -> 在选区内绘图。
5.  **输出**: 双击/回车 -> 复制到剪切板；保存按钮 -> 写入文件。

## 4. 界面布局 (UI Layout)

*   **全屏遮罩**: 黑色半透明遮罩 (0.3 opacity)，选区部分全透明 (高亮)。
*   **辅助信息**: 鼠标旁显示放大镜 (Magnifier) 和当前坐标/颜色值 (RGB/Hex)。
*   **尺寸标签**: 选区左上角显示 `W x H` 像素尺寸。
*   **主工具栏**:
    *   [矩形] [椭圆] [箭头] [画笔] [荧光笔] [文本] [马赛克] [序号] | [撤销] [重做] | [OCR] [长截图] [录制] | [取消] [完成]

## 5. 开发计划 (Roadmap)

1.  **基础截图**: 实现全屏遮罩、手动框选、复制/保存。
2.  **标注系统**: 集成 Fabric.js，实现基础形状绘制。
3.  **高级标注**: 实现马赛克、序号、文本输入。
4.  **OCR 集成**: 引入 Tesseract.js 实现选区文字识别。
5.  **智能与录制**: 探索 OpenCV 边缘检测与 GIF 录制实现。
