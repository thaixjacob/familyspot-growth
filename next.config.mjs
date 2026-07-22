/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The GA4 client is a Node-only library; keep it out of the edge bundle.
  serverExternalPackages: ['@google-analytics/data'],
};

export default nextConfig;
