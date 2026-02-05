import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  outputFileTracingRoot: path.join(__dirname),
  // Empty turbopack config to allow webpack config in Next.js 16
  turbopack: {},
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on"
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN"
          }
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

    // Only exclude @ffmpeg packages on server-side bundling
    // Client-side needs to load them dynamically
    if (isServer) {
      config.externals = [...(config.externals || []), '@ffmpeg/ffmpeg', '@ffmpeg/util'];
    }

    // Ignore warnings for dynamic imports
    config.module = config.module || {};
    (config.module as any).unknownContextCritical = false;
    (config.module as any).unknownContextRegExp = /^\.\/.*$/;
    (config.module as any).exprContextCritical = false;

    return config;
  },
};

export default nextConfig;
