import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trace from the monorepo root so the standalone bundle includes all
  // dependencies (incl. Next's own, e.g. styled-jsx) with a resolvable layout —
  // without this, pnpm-workspace tracing misses deps ("Cannot find module
  // 'styled-jsx/package.json'").
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  reactStrictMode: true,
  transpilePackages: ['@partengine/core'],
  // Proxy /api to the backend so the browser talks to the Next server
  // (same-origin) and Next forwards to the API. Target is baked at build time;
  // the desktop API runs on 47600 by default. Override with API_PROXY_TARGET.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || 'http://127.0.0.1:47600';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
  webpack: (config) => {
    // @partengine/core uses ESM-style ".js" import specifiers that point to ".ts"
    // sources; let webpack resolve them (tsc/esbuild already do).
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
