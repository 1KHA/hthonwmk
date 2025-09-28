/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase the body parser size limit
    },
    responseLimit: '10mb', // Increase the response size limit
  },
};

module.exports = nextConfig;
