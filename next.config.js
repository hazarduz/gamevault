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
  webpack: (config) => {
    // tesseract.js (browser build, dynamically imported on the import
    // page) references some Node built-ins it doesn't use in the browser.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
    };
    return config;
  },
};

module.exports = nextConfig;
