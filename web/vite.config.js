import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { proxy: { '/api': api, '/events': api, '/auth': api } },
});
