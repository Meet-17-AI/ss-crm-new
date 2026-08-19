import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Everything to crm-backend (:3003), which is what PRODUCTION does —
        // vercel.json rewrites all /api/* to crm.backend.srv1169280.hstgr.cloud.
        //
        // This used to split: /api/crm to :3003 and everything else to :3002
        // (server/index.ts, a near-duplicate 111-route backend that exists only
        // locally). So local dev exercised a service production never runs, and
        // the authentication added to crm-backend appeared not to work because
        // most calls never reached it. :3002 should not be started.
        proxy: {
          '/api': {
            target: 'http://localhost:3003',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
