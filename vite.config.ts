import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';
import { fileURLToPath } from 'url';

delete process.env.ELECTRON_RUN_AS_NODE;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(__dirname, 'src/renderer');

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/electron/main'),
            rollupOptions: {
              external: ['electron', 'koffi'],
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/electron/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/preload/capturePreload.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/electron/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
  ],
  root: rendererRoot,
  envDir: __dirname,
  base: './',
  publicDir: path.resolve(rendererRoot, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(rendererRoot, 'index.html'),
        capture: path.resolve(rendererRoot, 'capture.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
