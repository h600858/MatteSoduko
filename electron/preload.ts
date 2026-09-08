import { contextBridge, ipcRenderer } from 'electron';

/**
 * Broen mellom hovedprosessen og UI-et.
 *
 * Holdes bevisst liten: to navngitte kall for fremdriftsfilen, ikke generell
 * filtilgang. Renderer-en kan ikke velge hvilken fil som leses eller skrives.
 */
const api = {
  plattform: process.platform,
  versjoner: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  lesFremdrift: async (): Promise<string | null> => ipcRenderer.invoke('fremdrift:les'),
  skrivFremdrift: async (contents: string): Promise<void> =>
    ipcRenderer.invoke('fremdrift:skriv', contents),
} as const;

export type MatteSudokuApi = typeof api;

contextBridge.exposeInMainWorld('mattesudoku', api);
