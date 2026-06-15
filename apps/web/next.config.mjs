/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
