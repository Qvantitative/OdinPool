/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      // Digital Ocean routes
      {
        source: '/api/:path*',
        destination: 'http://143.198.17.64:3001/api/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://143.198.17.64:3001/socket.io/:path*',
      },
      // Ord server routes
      {
        source: '/ord/inscription/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/inscription/:path*'  // Development
          : 'http://68.9.235.71:3000/inscription/:path*',  // Production
      },
      {
        source: '/ord/content/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/content/:path*'  // Development
          : 'http://68.9.235.71:3000/content/:path*',  // Production
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Accept'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;