import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Phone testing through `npm run tunnel` (Cloudflare quick tunnel).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Dev only: in production this would let any trycloudflare.com page call our actions.
  ...(process.env.NODE_ENV === "development" && {
    experimental: { serverActions: { allowedOrigins: ["*.trycloudflare.com"] } },
  }),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
