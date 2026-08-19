import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { issueEnhancementPlugin } from './build/issueEnhancementPlugin';

export default defineConfig({
  base: './',
  plugins: [issueEnhancementPlugin(), react()],
  server: { host: '0.0.0.0', port: 5173 },
});
