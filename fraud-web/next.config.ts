import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.xn--12cainl6g3mua5b.com', 'xn--12cainl6g3mua5b.com'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
      { protocol: 'https', hostname: '*.line-scdn.net' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
