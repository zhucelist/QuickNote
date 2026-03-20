import { app } from 'electron';
import path from 'node:path';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import { Document } from 'flexsearch';

export interface SearchItem {
  id: string;
  name: string;
  path: string;
  type: 'app' | 'file' | 'folder';
  ext?: string;
}

export class FlexSearchIndexer {
  private isMac = process.platform === 'darwin';
  private isWindows = process.platform === 'win32';
  
  // FlexSearch 文档索引 - 使用 any 类型避免类型问题
  private appIndex: any;
  private fileIndex: any;
  
  // 原始数据存储
  private appData: Map<string, SearchItem> = new Map();
  private fileData: Map<string, SearchItem> = new Map();
  
  private isIndexing = false;
  private indexReady = false;
  private lastIndexTime = 0;
  private readonly INDEX_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟

  constructor() {
    // 初始化 FlexSearch 索引 - 支持中文的分词器
    this.appIndex = new Document({
      document: {
        id: 'id',
        index: ['name', 'path'],
        store: true
      },
      tokenize: 'full', // 使用 full 分词以支持中文
      resolution: 9,
      cache: true,
      context: true
    });

    this.fileIndex = new Document({
      document: {
        id: 'id',
        index: ['name', 'path'],
        store: true
      },
      tokenize: 'full', // 使用 full 分词以支持中文
      resolution: 9,
      cache: true,
      context: true
    });

    this.startIndexing();
  }

  private async startIndexing() {
    if (this.isIndexing) return;
    this.isIndexing = true;
    
    await this.buildIndex();
    
    // 定期刷新索引
    setInterval(() => {
      if (Date.now() - this.lastIndexTime > this.INDEX_REFRESH_INTERVAL) {
        this.buildIndex();
      }
    }, this.INDEX_REFRESH_INTERVAL);
  }

  private async buildIndex() {
    console.log('[FlexSearchIndexer] Building index...');
    const startTime = Date.now();
    
    try {
      // 清空现有索引
      this.appIndex = new Document({
        document: {
          id: 'id',
          index: ['name', 'path'],
          store: true
        },
        tokenize: 'full',
        resolution: 9,
        cache: true,
        context: true
      });

      this.fileIndex = new Document({
        document: {
          id: 'id',
          index: ['name', 'path'],
          store: true
        },
        tokenize: 'full',
        resolution: 9,
        cache: true,
        context: true
      });

      this.appData.clear();
      this.fileData.clear();

      if (this.isMac) {
        await this.buildMacIndex();
      } else if (this.isWindows) {
        await this.buildWindowsIndex();
      }
      
      this.lastIndexTime = Date.now();
      this.indexReady = true;
      console.log(`[FlexSearchIndexer] Index built in ${Date.now() - startTime}ms. Apps: ${this.appData.size}, Files: ${this.fileData.size}`);
    } catch (error) {
      console.error('[FlexSearchIndexer] Build index failed:', error);
    }
  }

  private async buildMacIndex() {
    const homeDir = app.getPath('home');
    
    // 并行构建应用和文件索引
    await Promise.all([
      this.indexMacApps(),
      this.indexMacFiles(homeDir)
    ]);
  }

  private async indexMacApps(): Promise<void> {
    const command = `mdfind "kMDItemContentTypeTree == 'com.apple.application-bundle'" | head -n 500`;
    const stdout = await this.execCommand(command);
    
    console.log(`[FlexSearchIndexer] mdfind returned ${stdout.split('\n').length} lines`);
    
    const banned = /(helper|updater|update|installer|uninstaller|daemon|service|crashpad|plugin|agent|renderer|gpu|webview)/i;
    
    const appPaths = stdout
      .split('\n')
      .filter(p => p.trim() && p.endsWith('.app'));

    // 获取应用的本地化名称
    const apps: SearchItem[] = [];
    for (const appPath of appPaths) {
      if (banned.test(path.basename(appPath, '.app'))) continue;
      
      // 尝试获取应用的本地化显示名称
      let displayName = path.basename(appPath, '.app');
      
      // 首先尝试使用 mdls 获取本地化名称（支持中文）
      try {
        const mdlsOutput = await this.execCommand(`mdls -name kMDItemDisplayName -raw "${appPath}" 2>/dev/null`);
        if (mdlsOutput && mdlsOutput.trim() && mdlsOutput.trim() !== '(null)') {
          displayName = mdlsOutput.trim();
        }
      } catch (error) {
        // mdls 失败，回退到读取 Info.plist
        try {
          const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
          if (fs.existsSync(infoPlistPath)) {
            const plistContent = fs.readFileSync(infoPlistPath, 'utf-8');
            
            // 尝试获取 CFBundleDisplayName
            const displayNameMatch = plistContent.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]+)<\/string>/);
            if (displayNameMatch) {
              displayName = displayNameMatch[1];
            } else {
              // 尝试获取 CFBundleName
              const bundleNameMatch = plistContent.match(/<key>CFBundleName<\/key>\s*<string>([^<]+)<\/string>/);
              if (bundleNameMatch) {
                displayName = bundleNameMatch[1];
              }
            }
          }
        } catch (plistError) {
          // 读取失败时使用默认名称
        }
      }
      
      apps.push({
        id: appPath,
        name: displayName,
        path: appPath,
        type: 'app' as const
      });
    }

    console.log(`[FlexSearchIndexer] Filtered to ${apps.length} apps`);
    console.log(`[FlexSearchIndexer] Sample apps:`, apps.slice(0, 10).map(a => a.name));

    // 添加到索引
    for (const app of apps) {
      this.appData.set(app.id, app);
      this.appIndex.add(app);
    }
  }

  private async indexMacFiles(homeDir: string): Promise<void> {
    // 使用 fd 索引常用文件类型 - 扩展更多办公和常用文件类型
    const extensions = [
      // 办公文档
      'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm',
      'xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'xltm', 'csv',
      'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'pps', 'ppsx',
      'pdf', 'txt', 'rtf', 'odt', 'ods', 'odp', 'odg', 'odf',
      'pages', 'numbers', 'keynote',
      // Markdown 和文本
      'md', 'markdown', 'mdown', 'mkd', 'mkdn', 'text', 'tex',
      // 代码文件
      'js', 'jsx', 'ts', 'tsx', 'json', 'json5', 'jsonc',
      'py', 'pyw', 'pyc', 'pyo', 'pyd',
      'java', 'class', 'jar',
      'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx',
      'go', 'rs', 'rb', 'php', 'swift', 'kt', 'kts',
      'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
      'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config',
      'sql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
      'vue', 'svelte', 'astro',
      // 图片
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'tiff', 'tif', 'ico', 'raw', 'psd', 'ai', 'sketch',
      // 视频
      'mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'webm', 'mpg', 'mpeg', 'mpe', 'mpv', '3gp',
      // 音频
      'mp3', 'aac', 'wav', 'flac', 'm4a', 'ogg', 'wma', 'aiff', 'au',
      // 压缩包
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz', 'tbz2',
      // 电子书
      'epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu',
      // 设计文件
      'fig', 'xd', 'sketch', 'principle',
      // 其他常用文件
      'log', 'diff', 'patch', 'lock', 'sum', 'mod', 'gradle', 'properties'
    ];
    
    // 首先尝试使用 fd 命令
    const extPattern = extensions.map(e => `-e ${e}`).join(' ');
    const fdCommand = `fd -t f ${extPattern} --max-results 10000 "${homeDir}" 2>/dev/null`;
    
    let stdout = '';
    
    try {
      stdout = await this.execCommand(fdCommand);
      if (!stdout.trim()) {
        throw new Error('fd command returned empty');
      }
    } catch (error) {
      // fd 不可用，使用 find 命令作为备选
      console.log('[FlexSearchIndexer] fd not available, using find command instead');
      
      // 构建 find 命令的 -name 参数
      const namePatterns = extensions.map(ext => `-name "*.${ext}"`).join(' -o ');
      const findCommand = `find "${homeDir}" -type f \\( ${namePatterns} \\) -maxdepth 4 2>/dev/null | head -n 5000`;
      
      try {
        stdout = await this.execCommand(findCommand);
      } catch (findError) {
        console.log('[FlexSearchIndexer] find command also failed:', findError);
        return;
      }
    }
    
    if (!stdout.trim()) {
      console.log('[FlexSearchIndexer] No files found');
      return;
    }
    
    const files = stdout
      .split('\n')
      .filter(p => p.trim())
      .map(p => {
        const fullPath = path.isAbsolute(p) ? p : path.join(homeDir, p);
        const ext = path.extname(fullPath).slice(1).toLowerCase();
        return {
          id: fullPath,
          name: path.basename(fullPath),
          path: fullPath,
          type: 'file' as const,
          ext
        };
      });

    // 添加到索引
    for (const file of files) {
      this.fileData.set(file.id, file);
      this.fileIndex.add(file);
    }
    
    console.log(`[FlexSearchIndexer] Indexed ${files.length} files`);
  }

  private async buildWindowsIndex() {
    // Windows 实现 - 可以使用 Everything 工具或 Windows Search API
    console.log('[FlexSearchIndexer] Windows indexing not yet implemented');
  }

  private execCommand(command: string): Promise<string> {
    return new Promise((resolve) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
        if (error) {
          resolve('');
        } else {
          resolve(stdout);
        }
      });
    });
  }

  // 搜索接口 - 支持中文搜索
  public async search(query: string, mode: 'all' | 'app' | 'file' = 'all'): Promise<SearchItem[]> {
    if (!query || query.trim().length === 0) return [];
    
    // 等待索引准备好
    if (!this.indexReady) {
      console.log('[FlexSearchIndexer] Index not ready yet, waiting...');
      // 最多等待 10 秒
      let waitCount = 0;
      while (!this.indexReady && waitCount < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      if (!this.indexReady) {
        console.log('[FlexSearchIndexer] Index still not ready, returning empty results');
        return [];
      }
    }
    
    const normalizedQuery = query.trim().toLowerCase();
    const results: SearchItem[] = [];
    
    console.log(`[FlexSearchIndexer] Searching for: "${normalizedQuery}"`);
    console.log(`[FlexSearchIndexer] App index size: ${this.appData.size}, File index size: ${this.fileData.size}`);
    
    // 搜索应用 - 使用简单的内存过滤
    if (mode === 'all' || mode === 'app') {
      for (const item of this.appData.values()) {
        const nameLower = item.name.toLowerCase();
        const pathLower = item.path.toLowerCase();
        
        if (nameLower.includes(normalizedQuery) || pathLower.includes(normalizedQuery)) {
          results.push(item);
        }
      }
    }
    
    // 搜索文件 - 使用简单的内存过滤
    if (mode === 'all' || mode === 'file') {
      for (const item of this.fileData.values()) {
        const nameLower = item.name.toLowerCase();
        const pathLower = item.path.toLowerCase();
        
        if (nameLower.includes(normalizedQuery) || pathLower.includes(normalizedQuery)) {
          results.push(item);
        }
      }
    }
    
    console.log(`[FlexSearchIndexer] Found ${results.length} raw results`);
    
    // 去重并限制结果数量
    const uniqueResults = this.deduplicateAndRank(results, normalizedQuery);
    console.log(`[FlexSearchIndexer] Returning ${uniqueResults.length} ranked results`);
    return uniqueResults.slice(0, 50);
  }

  // 高优先级目录（最近使用/常用）
  private highPriorityDirs = [
    '/downloads',
    '/desktop',
    '/documents',
    '/projects',
    '/workspace',
    '/work',
    '/source',
    '/src'
  ];
  
  // 低优先级目录
  private lowPriorityDirs = [
    '/library',
    '/system',
    '/private',
    '/usr',
    '/bin',
    '/sbin',
    '/opt/homebrew',
    '/node_modules',
    '/.git',
    '/.vscode',
    '/.idea',
    '/build',
    '/dist',
    '/target',
    '/out',
    '/.next',
    '/.nuxt'
  ];

  private deduplicateAndRank(items: SearchItem[], query: string): SearchItem[] {
    const seen = new Set<string>();
    const homeDir = app.getPath('home').toLowerCase();
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);
    
    return items
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(item => {
        const name = item.name.toLowerCase();
        const itemPath = item.path.toLowerCase();
        let score = 0;
        
        // ===== 名称匹配评分 =====
        // 精确匹配
        if (name === queryLower) {
          score += 2000;
        }
        // 忽略扩展名的精确匹配
        else if (name.replace(/\.[^.]+$/, '') === queryLower) {
          score += 1800;
        }
        // 开头匹配（权重最高）
        else if (name.startsWith(queryLower)) {
          score += 1500;
          // 开头匹配的额外奖励：匹配长度占比
          score += (queryLower.length / name.length) * 200;
        }
        // 单词边界匹配（如 "we" 匹配 "WeChat"）
        else if (new RegExp(`\\b${queryLower}`, 'i').test(name)) {
          score += 1200;
        }
        // 包含匹配
        else if (name.includes(queryLower)) {
          score += 800;
          // 包含位置越靠前得分越高
          const index = name.indexOf(queryLower);
          score += (name.length - index) * 5;
        }
        
        // 多 token 匹配（支持空格分隔的多关键词）
        if (queryTokens.length > 1) {
          const matchedTokens = queryTokens.filter(token => name.includes(token));
          score += matchedTokens.length * 300;
          // 全部匹配额外奖励
          if (matchedTokens.length === queryTokens.length) {
            score += 500;
          }
        }
        
        // ===== 路径匹配评分 =====
        if (itemPath.includes(queryLower)) {
          score += 200;
          // 路径中的匹配位置
          const pathIndex = itemPath.indexOf(queryLower);
          score += (itemPath.length - pathIndex) * 2;
        }
        
        // ===== 类型优先级 =====
        if (item.type === 'app') {
          score += 100;
          // 系统应用降低优先级
          if (itemPath.includes('/system/') || itemPath.includes('/library/')) {
            score -= 50;
          }
        }
        
        // ===== 目录优先级 =====
        // 高优先级目录
        for (const dir of this.highPriorityDirs) {
          if (itemPath.includes(dir)) {
            score += 100;
            break;
          }
        }
        
        // 低优先级目录（减分）
        for (const dir of this.lowPriorityDirs) {
          if (itemPath.includes(dir)) {
            score -= 200;
            break;
          }
        }
        
        // 用户目录优先
        if (itemPath.includes(homeDir)) {
          score += 80;
          // 用户目录下的高优先级子目录
          const relativePath = itemPath.replace(homeDir, '');
          for (const dir of this.highPriorityDirs) {
            if (relativePath.includes(dir)) {
              score += 50;
              break;
            }
          }
        }
        
        // ===== 文件扩展名优先级 =====
        if (item.type === 'file' && item.ext) {
          const highPriorityExts = ['app', 'doc', 'docx', 'pdf', 'txt', 'md', 'xlsx', 'pptx'];
          const mediumPriorityExts = ['js', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'java'];
          
          if (highPriorityExts.includes(item.ext.toLowerCase())) {
            score += 60;
          } else if (mediumPriorityExts.includes(item.ext.toLowerCase())) {
            score += 30;
          }
        }
        
        // ===== 文件名长度惩罚（避免过长的文件名排在前面）=====
        if (name.length > 50) {
          score -= (name.length - 50) * 2;
        }
        
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  // 获取索引状态
  public getStatus() {
    return {
      isIndexing: this.isIndexing,
      lastIndexTime: this.lastIndexTime,
      appCount: this.appData.size,
      fileCount: this.fileData.size
    };
  }

  // 强制刷新索引
  public async refreshIndex() {
    await this.buildIndex();
  }
}
