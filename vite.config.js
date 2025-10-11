import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint";

// https://vitejs.dev/config/
export default defineConfig({
  // Local development için base: '/', production için base: '/'
  base: '/',
  plugins: [react(), eslint()],
  
  // 🚀 PERFORMANCE OPTIMIZATIONS
  build: {
    // Chunk size optimization
    chunkSizeWarningLimit: 1000,
    
    // 📦 Smaller chunks = faster loading
    cssCodeSplit: true,
    
    // 📊 Compression
    reportCompressedSize: true,
    
    rollupOptions: {
      output: {
        // Code splitting for faster initial load
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/themes', '@radix-ui/react-icons'],
          'query-vendor': ['@tanstack/react-query'],
          'video-vendor': ['video.js', '@videojs/http-streaming', 'hls.js'],
          'utils-vendor': ['axios', 'dompurify', 'date-fns'],
        },
        // 💼 Asset filenames
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
      // 🌐 CDN Externals - Use global variables from CDN (PRODUCTION)
      // Uncomment in production to use CDN versions
      external: process.env.NODE_ENV === 'production' ? [
        // These will be loaded from CDN in production
        // 'react',
        // 'react-dom',
        // 'axios',
      ] : [],
    },
    // Minification - esbuild is faster than terser!
    minify: 'esbuild',
    
    // esbuild options
    esbuildOptions: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none', // Remove comments
    },
    
    // 📈 Source maps only in development
    sourcemap: process.env.NODE_ENV !== 'production',
    
    // 🚀 Target modern browsers for smaller bundles
    target: 'es2020',
  },
  
  // Development server optimizations
  server: {
    hmr: {
      overlay: false, // Disable error overlay for speed
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'axios', 'video.js'],
    exclude: ['@videojs/http-streaming'], // Prevent double-bundling
  },
  
  // 📡 CDN Strategy - Load heavy libraries from CDN
  resolve: {
    alias: {
      // Optionally alias to CDN versions in production
    }
  },
  
});
