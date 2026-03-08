import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export class Store {
  private path: string;
  private data: Record<string, any>;

  constructor(opts: { configName: string; defaults: Record<string, any> }) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.data = parseDataFile(this.path, opts.defaults);
  }

  get(key: string) {
    return this.data[key];
  }

  set(key: string, val: any) {
    // 读取磁盘上的最新内容，避免多个 Store 实例相互覆盖
    let diskData: Record<string, any> = {};
    try {
      const raw = fs.readFileSync(this.path, 'utf-8');
      diskData = JSON.parse(raw);
    } catch {
      diskData = {};
    }
    const merged = { ...diskData, ...this.data, [key]: val };
    this.data = merged;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath: string, defaults: any) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return defaults;
  }
}
