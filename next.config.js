/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  api: {
    bodyParser: {
      sizeLimit: '30mb', // Increased to handle 25MB files plus overhead
    },
    responseLimit: '30mb', // Increased response size limit
  },
  experimental: {
    // Increase the maximum request body size for App Router
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
