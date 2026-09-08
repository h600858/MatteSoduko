import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { defineConfig } from 'vitest/config';

/**
 * Under vitest skal ingenting av Electron-byggingen kjøre. Testene rører bare
 * core/, som er ren TypeScript uten UI.
 */
const isTest = process.env['VITEST'] !== undefined;

const electronPlugin = electron({
  main: {
    entry: 'electron/main.ts',
    vite: {
      build: {
        outDir: 'dist-electron',
        rollupOptions: {
          // .mjs gjør det utvetydig at hovedprosessen er ESM.
          output: { format: 'es', entryFileNames: '[name].mjs' },
        },
      },
    },
  },
  preload: {
    input: 'electron/preload.ts',
    vite: {
      build: {
        outDir: 'dist-electron',
        rollupOptions: {
          // Preload må være CommonJS når sandkassen er på.
          output: { format: 'cjs', entryFileNames: '[name].cjs' },
        },
      },
    },
  },
});

/**
 * `vite --mode web` kjører bare renderer-en i en vanlig nettleser, uten å starte
 * Electron. Brukes når UI-et skal inspiseres uten et appvindu.
 */
export default defineConfig(({ mode }) => {
  const withoutElectron = isTest || mode === 'web';

  return {
    // Relative stier, slik at dist/index.html kan lastes fra file:// i Electron.
    base: './',
    plugins: isTest ? [] : withoutElectron ? [react()] : [react(), electronPlugin],
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
      testTimeout: 120_000,
      hookTimeout: 60_000,
    },
  };
});
