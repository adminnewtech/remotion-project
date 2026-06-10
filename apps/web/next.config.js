/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TS/ESM source — let Next compile them.
  transpilePackages: [
    '@elite/types',
    '@elite/core',
    '@elite/ui',
    '@elite/i18n',
    '@elite/config',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    // Keep RSC payloads lean for the large catalog pages.
    optimizePackageImports: ['@elite/ui'],
  },
};

module.exports = nextConfig;
