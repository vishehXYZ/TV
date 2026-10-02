import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  // Vercel serves the app from the domain root ('/'), but a GitHub Pages project site
  // serves it from a '/<repo-name>/' subpath — without this, every asset URL would
  // resolve against the wrong origin and 404. The GITHUB_PAGES env var is set only by
  // the Pages deploy workflow below, so local dev and Vercel both stay on '/'.
  base: process.env.GITHUB_PAGES
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'TV'}/`
    : '/',
  plugins: [glsl()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
