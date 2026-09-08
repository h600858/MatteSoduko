import { contextBridge } from 'electron';

/**
 * Broen mellom hovedprosessen og UI-et.
 *
 * Holdes bevisst liten. I M6 kommer lesing og skriving av progress.json hit,
 * som to navngitte kall, ikke som generell filtilgang.
 */
const api = {
  plattform: process.platform,
  versjoner: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
} as const;

export type MatteSudokuApi = typeof api;

contextBridge.exposeInMainWorld('mattesudoku', api);
