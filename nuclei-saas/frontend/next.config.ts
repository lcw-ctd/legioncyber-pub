import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    NEXT_PUBLIC_APP_NAME: 'LegionCyber Shield',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ]
  },
  images: {
    domains: ['localhost', 'api.legioncyber.com'],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'shield.legioncyber.com'],
    },
  },
}

export default nextConfig
