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
        destination: 'https://143.198.17.64:3001/api/:path*',  // HTTPS for security
      },
      {
        source: '/socket.io/:path*',
        destination: 'https://143.198.17.64:3001/socket.io/:path*',  // HTTPS for security
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
      },
      {
        source: '/ord/address/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000/content/:path*'
          : 'http://68.9.235.71:3000/content/:path*',
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
            value: '*'  // Permissive; consider restricting in production
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
