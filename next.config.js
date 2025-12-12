/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const internalHost = process.env.TAURI_DEV_HOST || 'localhost';

const nextConfig = {
  // Enable static export for Tauri
  output: 'export',
  experimental: {
    serverMinification: false
  },
  serverExternalPackages: ['@supabase/supabase-js'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Required for Next.js Image component in SSG mode
  images: {
    unoptimized: true,
  },
  // Configure assetPrefix for Tauri dev mode
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
  trailingSlash: false,
  // Hide dev indicators (Next.js logo in corner)
  devIndicators: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
  // Optimize for production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig