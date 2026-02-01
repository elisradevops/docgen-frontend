import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react({
      babel: {
        plugins: [
          // Ensure proper transpilation for older browsers
          ['@babel/plugin-transform-runtime', { regenerator: true }],
          '@babel/plugin-transform-optional-chaining',
          '@babel/plugin-transform-nullish-coalescing-operator'
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
  },
  build: {
    outDir: 'ado-extension/dist',
    emptyOutDir: true,
    target: ['es2015', 'edge92', 'chrome92'], // Explicit Edge 92 target
    cssTarget: 'chrome61', // CSS compatibility for older browsers
    minify: 'terser', // Better compatibility than esbuild for old browsers
    terserOptions: {
      compress: {
        drop_console: false,
        ecma: 2015
      },
      format: {
        ecma: 2015
      }
    }
  },
  css: {
    postcss: {
      plugins: [
        // Add autoprefixer for CSS compatibility
        autoprefixer({
          overrideBrowserslist: ['Edge >= 92', 'Chrome >= 92']
        })
      ]
    }
  }
});
