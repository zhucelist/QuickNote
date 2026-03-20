import { ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

type OCRResult = { text: string; confidence: number };

export class OCRManager {
  private worker: any | null = null;
  private currentLanguage = '';
  private langPath: string;
  private queue: Promise<unknown> = Promise.resolve();
  private createWorker: ((...args: any[]) => Promise<any>) | null = null;

  constructor() {
    this.langPath = path.join(process.env.VITE_PUBLIC as string, 'tessdata');
    this.registerIpcHandlers();
  }

  private async getWorker(language: string): Promise<any> {
    if (this.worker && this.currentLanguage !== language) {
      await this.worker.terminate();
      this.worker = null;
      this.currentLanguage = '';
    }

    if (!this.worker) {
      if (!fs.existsSync(this.langPath)) {
        throw new Error(`tessdata 目录不存在: ${this.langPath}`);
      }

      if (!this.createWorker) {
        const require = createRequire(import.meta.url);
        const mod = require('tesseract.js') as any;
        this.createWorker = mod?.createWorker;
        if (typeof this.createWorker !== 'function') {
          throw new Error('tesseract.js createWorker 不可用');
        }
      }

      this.worker = await this.createWorker(language, 1, {
        langPath: this.langPath,
        errorHandler: (e: any) => {
          console.error('[OCR] Worker error:', e);
        },
      });
      this.currentLanguage = language;

      await this.worker.setParameters({
        preserve_interword_spaces: '1',
      });
    }

    return this.worker;
  }

  private registerIpcHandlers() {
    try {
      ipcMain.removeHandler('ocr-recognize');
    } catch {
    }
    ipcMain.handle('ocr-recognize', async (_event, payload: { image: string; language?: string }) => {
      const language = payload?.language || 'chi_sim+eng';
      const image = payload?.image;

      this.queue = this.queue.then(async () => {
        if (!image) {
          return { text: '', confidence: 0 } satisfies OCRResult;
        }

        const tryRecognize = async (lang: string) => {
          const worker = await this.getWorker(lang);
          await worker.setParameters({
            preserve_interword_spaces: '1',
            user_defined_dpi: '300',
            tessedit_pageseg_mode: '6',
          });
          let result = await worker.recognize(image) as unknown as { data: { text: string; confidence: number } };
          const text = String(result?.data?.text || '').trim();
          if (!text) {
            await worker.setParameters({
              preserve_interword_spaces: '1',
              user_defined_dpi: '300',
              tessedit_pageseg_mode: '3',
            });
            result = await worker.recognize(image) as unknown as { data: { text: string; confidence: number } };
          }
          return result;
        };

        try {
          const result = await tryRecognize(language);
          return { text: result.data.text || '', confidence: result.data.confidence || 0 } satisfies OCRResult;
        } catch {
          if (String(language).includes('chi')) {
            try {
              const result = await tryRecognize('chi_sim');
              return { text: result.data.text || '', confidence: result.data.confidence || 0 } satisfies OCRResult;
            } catch {
            }
          }
          if (String(language).includes('eng')) {
            try {
              const result = await tryRecognize('eng');
              return { text: result.data.text || '', confidence: result.data.confidence || 0 } satisfies OCRResult;
            } catch {
            }
          }
          return { text: '', confidence: 0 } satisfies OCRResult;
        }
      });

      return this.queue as Promise<OCRResult>;
    });
  }

  public async destroy(): Promise<void> {
    try {
      ipcMain.removeHandler('ocr-recognize');
    } catch {
    }
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.currentLanguage = '';
    }
  }
}
