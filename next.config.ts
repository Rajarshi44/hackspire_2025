import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize for Vercel deployment (disable standalone for local dev)
  output: process.env.VERCEL ? 'standalone' : undefined,
  
  // Configure webpack for serverless functions
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Optimize bundle size for serverless functions
      config.externals = [...config.externals, 'canvas', 'jsdom'];
    }
    return config;
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // External packages configuration for serverless
  serverExternalPackages: ['genkit'],
};

export default nextConfig;
