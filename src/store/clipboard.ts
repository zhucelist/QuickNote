import { create } from 'zustand';

export type ClipboardItem = {
  id: string;
  type: 'text' | 'image';
  content: string;
  timestamp: number;
};

interface ClipboardState {
  history: ClipboardItem[];
  searchQuery: string;
  setHistory: (history: ClipboardItem[]) => void;
  setSearchQuery: (query: string) => void;
  copyItem: (item: ClipboardItem) => void;
  clearHistory: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  history: [],
  searchQuery: '',
  setHistory: (history) => set({ history }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  copyItem: (item) => {
    window.ipcRenderer.send('copy-item', item);
  },
  clearHistory: () => {
    window.ipcRenderer.send('clear-history');
    set({ history: [] });
  },
}));
