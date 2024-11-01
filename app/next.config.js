/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://143.198.17.64:3001/api/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://143.198.17.64:3001/socket.io/:path*',
      }
    ];
  },
};

module.exports = nextConfig;