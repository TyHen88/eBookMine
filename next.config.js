/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist references the Node-only 'canvas' package; the browser build
  // doesn't need it. Alias it away for both bundlers (Turbopack is the Next 16
  // default; webpack only applies when building with `--webpack`).
  turbopack: {
    resolveAlias: {
      canvas: "./empty-module.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
