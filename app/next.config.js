/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      // Digital Ocean routes (keep these as they are)
      {
        source: '/api/:path*',
        destination: 'http://143.198.17.64:3001/api/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://143.198.17.64:3001/socket.io/:path*',
      },
      // Local ord server routes (new)
      {
        source: '/ord/api/:path*',
        destination: 'http://localhost:3000/:path*',  // Local ord server
      },
      {
        source: '/ord/content/:path*',
        destination: 'http://localhost:3000/content/:path*',  // For inscription content
      },
      {
        source: '/ord/inscription/:path*',
        destination: 'http://localhost:3000/inscription/:path*', // For inscription metadata
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