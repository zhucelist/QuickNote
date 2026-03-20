import { ipcRenderer, contextBridge } from 'electron'

const listenerStore = new Map<string, Map<Function, Function>>()

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    const wrapped = (event: unknown, ...rest: unknown[]) => (listener as any)(event, ...rest)
    if (!listenerStore.has(channel)) listenerStore.set(channel, new Map())
    listenerStore.get(channel)!.set(listener as any, wrapped)
    return ipcRenderer.on(channel, wrapped as any)
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    const candidate = omit[0] as any
    const wrapped = listenerStore.get(channel as any)?.get(candidate)
    if (wrapped) {
      listenerStore.get(channel as any)!.delete(candidate)
      return ipcRenderer.off(channel, wrapped as any)
    }
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// Helper to safely serialize args for IPC
const safeSerialize = (arg: any): any => {
    if (arg instanceof Error) {
        return { message: arg.message, stack: arg.stack, name: arg.name };
    }
    if (typeof arg === 'object' && arg !== null) {
        try {
            // Check if it's a simple object by trying to stringify
            JSON.stringify(arg);
            return arg;
        } catch (e) {
            // If circular or non-serializable, return string representation
            return String(arg);
        }
    }
    return arg;
};

// Intercept Console Logs and send to Main Process
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
};

const forwardToMain = (level: string, ...args: any[]) => {
    try {
        const serializedArgs = args.map(safeSerialize);
        ipcRenderer.send('renderer-console', level, ...serializedArgs);
    } catch (e) {
        // Fallback if serialization fails completely
        ipcRenderer.send('renderer-console', 'error', 'Failed to forward log:', String(e));
    }
};

contextBridge.exposeInMainWorld('electronConsole', {
    log: (...args: any[]) => {
        originalConsole.log(...args);
        forwardToMain('log', ...args);
    },
    error: (...args: any[]) => {
        originalConsole.error(...args);
        forwardToMain('error', ...args);
    },
    warn: (...args: any[]) => {
        originalConsole.warn(...args);
        forwardToMain('warn', ...args);
    },
    info: (...args: any[]) => {
        originalConsole.info(...args);
        forwardToMain('info', ...args);
    },
    debug: (...args: any[]) => {
        originalConsole.debug(...args);
        forwardToMain('debug', ...args);
    }
});

// 另外，如果需要全局拦截，直接覆盖 console（仅在 contextIsolation: false 时有效，但现在推荐用 expose）
// 在 contextIsolation: true 下，我们无法直接覆盖 window.console
// 所以这里只是提供一个辅助 API。前端如果想自动转发，需要手动调用 window.electronConsole.log
// 或者在前端入口处自己劫持 console 并调用 window.electronConsole

