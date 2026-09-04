/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.igdb.com" },
    ],
  },
  experimental: {
    // Keep psn-api out of the server bundle — require() it at runtime
    // from node_modules instead. Avoids build-time bundling issues with
    // its dual CJS/ESM exports map.
    serverComponentsExternalPackages: ["psn-api"],
  },
};

module.exports = nextConfig;
