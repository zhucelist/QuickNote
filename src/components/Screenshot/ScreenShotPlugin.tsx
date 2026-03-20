import { useEffect, useRef, useCallback } from 'react';
import ScreenShot from 'js-web-screen-shot';

interface ScreenShotPluginProps {
  backgroundImage: string | null;
  onComplete: (dataURL: string) => void;
  onClose: () => void;
  onSave?: (dataURL: string) => void;
}

export const ScreenShotPlugin: React.FC<ScreenShotPluginProps> = ({
  backgroundImage,
  onComplete,
  onClose,
  onSave,
}) => {
  const screenShotRef = useRef<ScreenShot | null>(null);

  const initScreenShot = useCallback(() => {
    if (!backgroundImage) return;

    // 销毁之前的实例
    if (screenShotRef.current) {
      screenShotRef.current.destroyComponents();
      screenShotRef.current = null;
    }

    const config = {
      // 使用自定义图片（Electron 截图）
      imgSrc: backgroundImage,
      enableWebRtc: false, // 关闭 WebRTC，使用自定义图片
      
      // 图片自适应
      imgAutoFit: true,
      
      // 显示截图内容
      showScreenData: true,
      
      // 画布尺寸（使用窗口大小）
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
      toolPosition: 'center' as const,
      
      // 完成截图回调
      completeCallback: ({ base64 }: { base64: string }) => {
        onComplete(base64);
      },
      
      // 关闭回调
      closeCallback: () => {
        onClose();
      },
      
      // 保存回调
      saveCallback: (code: number) => {
        if (code === 0 && screenShotRef.current) {
          // 获取当前截图的 base64
          const canvas = screenShotRef.current.getCanvasController();
          if (canvas) {
            const dataURL = canvas.toDataURL('image/png');
            onSave?.(dataURL);
          }
        }
      },
      
      // 自定义右键事件 - 禁用右键菜单
      customRightClickEvent: {
        state: true,
        handleFn: () => {
          // 不执行任何操作，禁用右键
        },
      },
      
      // 隐藏不需要的工具栏图标
      hiddenToolIco: {
        // 可以根据需要隐藏某些工具
        // save: true, // 隐藏下载按钮，使用自定义保存
      },
      
      // 不自动销毁容器（我们手动控制）
      destroyContainer: false,
      
      // 不写入剪贴板（我们手动控制）
      writeBase64: false,
    };

    screenShotRef.current = new ScreenShot(config);
  }, [backgroundImage, onComplete, onClose, onSave]);

  useEffect(() => {
    initScreenShot();

    return () => {
      if (screenShotRef.current) {
        screenShotRef.current.destroyComponents();
        screenShotRef.current = null;
      }
    };
  }, [initScreenShot]);

  // 监听 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return null; // 这个组件不渲染任何 DOM，截图库会自己创建容器
};

export default ScreenShotPlugin;
