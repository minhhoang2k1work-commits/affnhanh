/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.AFF_LIVE_PREVIEW === '1' ? '.next-live' : '.next',
  serverExternalPackages: ['playwright', 'ffmpeg-static'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.susercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.shopee.vn',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: '**.byteoversea.com',
      },
      {
        protocol: 'https',
        hostname: '**.ibytedtos.com',
      },
    ],
  },
};

export default nextConfig;
