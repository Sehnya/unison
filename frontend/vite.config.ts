import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine project root (one level up from frontend/)
// frontend/ is in the project root, so we go up one level
const projectRoot = join(__dirname, '..');

// Load .env file from project root using dotenv
const envPath = join(projectRoot, '.env');
const dotenvResult = config({ path: envPath });
if (dotenvResult.error) {
  console.warn('⚠️  Could not load .env from:', envPath);
  // Try current directory as fallback
  const fallbackResult = config();
  if (fallbackResult.error) {
    console.warn('⚠️  Could not load .env from current directory either');
  } else {
    console.log('✓ Loaded .env file using dotenv from current directory');
  }
} else {
  console.log('✓ Loaded .env file using dotenv from:', envPath);
  // Log the key was loaded (without exposing the actual key)
  if (process.env.VITE_ABLY_API_KEY) {
    console.log('✓ VITE_ABLY_API_KEY found in process.env (length:', process.env.VITE_ABLY_API_KEY.length + ')');
  }
}

export default defineConfig(({ mode }) => {
  // Load env vars using Vite's loadEnv from project root
  // loadEnv looks for .env files in the specified directory
  const env = loadEnv(mode, projectRoot, '');
  
  // Get the API key from multiple sources
  const ablyKey = env.VITE_ABLY_API_KEY || process.env.VITE_ABLY_API_KEY || '';
  
  // Log for debugging
  console.log('🔍 Environment variables loaded:', {
    'Project root': projectRoot,
    'VITE_ABLY_API_KEY exists': !!ablyKey,
    'VITE_ABLY_API_KEY length': ablyKey.length,
    'From env object': !!env.VITE_ABLY_API_KEY,
    'From process.env': !!process.env.VITE_ABLY_API_KEY,
    'All VITE_ vars in env': Object.keys(env).filter(k => k.startsWith('VITE_')),
  });
  
  return {
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying:', req.method, req.url, '->', proxyReq.path);
          });
        },
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/guilds': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/channels': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/messages': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.{test,spec,property.test}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['node_modules', 'dist']
  },
  // Explicitly define env vars to expose to client
  // Using define ensures the variable is available at build/runtime
  define: ablyKey ? {
    'import.meta.env.VITE_ABLY_API_KEY': JSON.stringify(ablyKey),
  } : {},
  // Vite automatically exposes VITE_ prefixed vars, but we're being explicit
  envPrefix: ['VITE_']
  };
});
