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
