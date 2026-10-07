import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      // Local PartyKit dev server (npm run dev starts both).
      '/parties': { target: 'http://127.0.0.1:1999', changeOrigin: true, ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('react-chessboard') || id.includes('@dnd-kit')) return 'board';
            if (id.includes('motion') || id.includes('framer')) return 'motion';
          }
          return undefined;
        },
      },
    },
  },
});
