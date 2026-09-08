import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BrowserWindow, app, shell } from 'electron';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Satt av vite-plugin-electron under utvikling. */
const devServerUrl = process.env['VITE_DEV_SERVER_URL'];

/** dist-electron/ ligger ved siden av dist/ i prosjektroten. */
const rootDir = path.join(dirname, '..');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: 'MatteSudoku',
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Appen er offline. Eventuelle eksterne lenker skal ut i systemnettleseren,
  // ikke inn i appvinduet.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (devServerUrl !== undefined && devServerUrl !== '') {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(rootDir, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(
  () => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  },
  (error: unknown) => {
    console.error('Klarte ikke å starte appen:', error);
    app.quit();
  },
);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
