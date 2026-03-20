interface OCROptions {
  language?: string;
  onProgress?: (progress: number) => void;
}

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const preprocessForOcr = async (dataUrl: string) => {
  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = src;
    });

  const img = await load(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return dataUrl;

  const maxSide = Math.max(w, h);
  const targetMaxSide = 2200;
  const scale = Math.min(3, Math.max(1, targetMaxSide / maxSide));

  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return dataUrl;

  (ctx as any).imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';
  ctx.filter = 'contrast(160%) brightness(115%) saturate(0%)';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.filter = 'none';

  return c.toDataURL('image/png');
};

/**
 * 识别图片中的文字
 * @param image - 图片的 Data URL 或 File 对象
 * @param options - OCR 选项
 * @returns OCR 结果
 */
export const recognizeText = async (
  image: string | File,
  options: OCROptions = {}
): Promise<OCRResult> => {
  const { language = 'chi_sim+eng', onProgress } = options;

  try {
    onProgress?.(0);

    let dataUrl = typeof image === 'string' ? image : await fileToDataUrl(image);
    if (typeof dataUrl === 'string' && language.includes('chi')) {
      try {
        onProgress?.(0.15);
        dataUrl = await preprocessForOcr(dataUrl);
      } catch {
      }
    }
    const result = await Promise.race([
      window.ipcRenderer.invoke('ocr-recognize', { image: dataUrl, language }),
      new Promise((_r, reject) => window.setTimeout(() => reject(new Error('OCR timeout')), 30000)),
    ]) as { text: string; confidence: number };

    onProgress?.(1);

    return {
      text: result?.text || '',
      confidence: result?.confidence || 0,
      words: [],
    };
  } catch (error) {
    console.error('[OCR] Recognition failed:', error);
    // 返回空结果而不是抛出错误，避免应用崩溃
    return {
      text: '',
      confidence: 0,
      words: [],
    };
  } finally {
    onProgress?.(1);
  }
};

/**
 * 批量识别多张图片
 * @param images - 图片数组
 * @param options - OCR 选项
 * @returns 识别结果数组
 */
export const recognizeMultiple = async (
  images: (string | File)[],
  options: OCROptions = {}
): Promise<OCRResult[]> => {
  const results: OCRResult[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const result = await recognizeText(images[i], options);
      results.push(result);
    } catch (error) {
      console.error(`[OCR] Failed to recognize image ${i}:`, error);
      results.push({
        text: '',
        confidence: 0,
        words: [],
      });
    }
  }

  return results;
};

/**
 * 终止 OCR Worker
 * 在应用退出时调用，释放资源
 */
export const terminateWorker = async (): Promise<void> => {
  return;
};

/**
 * 获取支持的语言列表
 */
export const getSupportedLanguages = (): Array<{ code: string; name: string }> => {
  return [
    { code: 'chi_sim', name: '简体中文' },
    { code: 'chi_tra', name: '繁体中文' },
    { code: 'eng', name: 'English' },
    { code: 'chi_sim+eng', name: '中文+英文' },
    { code: 'jpn', name: '日本語' },
    { code: 'kor', name: '한국어' },
    { code: 'fra', name: 'Français' },
    { code: 'deu', name: 'Deutsch' },
    { code: 'spa', name: 'Español' },
    { code: 'rus', name: 'Русский' },
  ];
};
