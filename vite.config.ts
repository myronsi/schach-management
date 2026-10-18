import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const DEFAULT_API_BASE = 'https://sc-laufenburg.de/api';

const originOf = (url: string | undefined): string | null => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

/**
 * Production builds get a Content-Security-Policy meta tag. The auth token lives in localStorage,
 * so the policy limits what injected script could do: no inline/foreign scripts, and requests only
 * to the app itself and the configured API/site origins.
 */
const contentSecurityPolicy = (env: Record<string, string>): Plugin => {
  const apiBase = env.VITE_API_BASE || DEFAULT_API_BASE;
  const apiOrigin = originOf(apiBase);
  const siteOrigin = originOf(env.VITE_SITE_BASE || apiBase.replace(/\/api\/?$/, ''));
  const remote = [...new Set([apiOrigin, siteOrigin].filter(Boolean))].join(' ');
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // Radix/shadcn set inline style attributes; fonts come from Google Fonts (src/index.css).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Images/videos may be external URLs entered by editors, plus local previews (blob:/data:).
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src 'self' ${remote}`,
    `frame-src 'self' ${remote}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    server: {
      port: 8080,
    },
    plugins: [
      react(),
      contentSecurityPolicy(env),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
