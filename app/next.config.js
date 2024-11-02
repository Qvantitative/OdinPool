/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      // Local API routes that should NOT be proxied to Digital Ocean
      {
        source: '/api/bitcoin-blocks',
        destination: '/api/bitcoin-blocks' // Keep this route local
      },
      // Digital Ocean routes (all other API routes)
      {
        source: '/api/:path*',
        destination: 'http://143.198.17.64:3001/api/:path*',
        has: [
          {
            type: 'query',
            key: 'path',
            value: '(?!bitcoin-blocks).*' // Exclude bitcoin-blocks
          }
        ]
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://143.198.17.64:3001/socket.io/:path*',
      },
      // Ord server routes
      {
        source: '/ord/inscription/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/inscription/:path*'
          : 'http://68.9.235.71:3000/inscription/:path*',
      },
      {
        source: '/ord/content/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/content/:path*'
          : 'http://68.9.235.71:3000/content/:path*',
      }
    ];
  },
  // ... rest of your config
};

module.exports = nextConfig;