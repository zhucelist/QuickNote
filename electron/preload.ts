import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
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

contextBridge.exposeInMainWorld('console', {
    ...originalConsole,
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
