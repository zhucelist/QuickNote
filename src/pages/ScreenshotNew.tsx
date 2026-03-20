import React, { useState, useEffect } from 'react';
import ScreenShot from 'js-web-screen-shot';

export const ScreenshotPage: React.FC = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenShotHandler, setScreenShotHandler] = useState<ScreenShot | null>(null);

  useEffect(() => {
    // 设置截图模式下 body 透明
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const handleScreenshotData = (_event: unknown, data: string) => {
      setScreenshot(data);
    };

    window.ipcRenderer.on('screenshot-data', handleScreenshotData);

    return () => {
      window.ipcRenderer.off('screenshot-data', handleScreenshotData);
      // 销毁截图实例
      if (screenShotHandler) {
        screenShotHandler.destroyComponents();
      }
    };
  }, [screenShotHandler]);

  // 初始化截图组件
  useEffect(() => {
    if (!screenshot) return;

    const handler = new ScreenShot({
      // 使用自定义图片（Electron 截图）
      imgSrc: screenshot,
      enableWebRtc: false,
      
      // 图片自适应
      imgAutoFit: true,
      
      // 显示截图内容
      showScreenData: true,
      
      // 画布尺寸
      canvasWidth: window.innerWidth,
      canvasHeight: window.innerHeight,
      
      // 容器层级
      level: 99999,
      
      // 蒙层颜色
      maskColor: { r: 0, g: 0, b: 0, a: 0.6 },
      
      // 裁剪框颜色
      cutBoxBdColor: '#3b82f6',
      
      // 最大撤销次数
      maxUndoNum: 20,
      
      // 工具栏位置
      toolPosition: 'center',
      
      // 完成截图回调
      completeCallback: ({ base64 }: { base64: string }) => {
        // 复制到剪贴板
        window.ipcRenderer.send('save-screenshot', { dataURL: base64 });
        // 关闭截图窗口
        window.ipcRenderer.send('close-screenshot');
      },
      
      // 关闭回调
      closeCallback: () => {
        window.ipcRenderer.send('close-screenshot');
      },
      
      // 保存回调
      saveCallback: () => {
        // 获取当前截图的 base64 并保存到文件
        const canvas = handler.getCanvasController();
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          window.ipcRenderer.send('save-screenshot-file', { dataURL });
        }
        window.ipcRenderer.send('close-screenshot');
      },
      
      // 不自动销毁容器
      destroyContainer: false,
      
      // 不写入剪贴板（我们手动控制）
      writeBase64: false,
    });

    setScreenShotHandler(prev => {
      prev?.destroyComponents();
      return handler;
    });

    return () => {
      handler.destroyComponents();
    };
  }, [screenshot]);

  return (
    <div 
      className="fixed inset-0 w-screen h-screen" 
      style={{ background: 'transparent', zIndex: 99999 }}
    >
      {/* js-web-screen-shot 会自动创建截图容器 */}
    </div>
  );
};

export default ScreenshotPage;
