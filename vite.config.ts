import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    target: 'es2022',
    sourcemap: mode !== 'release',
  },
  test: {
    environment: 'node',
  },
}));
