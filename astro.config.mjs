// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://danielaburquez.com',
  build: {
    // Never inline CSS into <style> tags. Keeping styles in real files lets the
    // Content-Security-Policy use `style-src 'self'` without 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Never inline small assets (fonts, images, scripts) as data: URIs or
      // inline <script> blocks. Same reason: the CSP only allows our own files.
      assetsInlineLimit: 0,
    },
  },
});
