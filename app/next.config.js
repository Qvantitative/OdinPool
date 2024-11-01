/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove distDir since Vercel handles this
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

// Change to CommonJS export for compatibility
module.exports = nextConfig;