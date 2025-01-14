/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xeurmlpoeyiwkzedxvie.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    domains: ['picsum.photos', 'cloudflare-ipfs.com'],
  },
};

module.exports = nextConfig;
