import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Phone testing through `npm run tunnel` (Cloudflare quick tunnel).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Dev only: in production this would let any trycloudflare.com page call our actions.
  ...(process.env.NODE_ENV === "development" && {
    experimental: { serverActions: { allowedOrigins: ["*.trycloudflare.com"] } },
  }),
  outputFileTracingIncludes: {
    "/apply": ["./src/lib/indemnification/template.pdf"],
    // Email logos are attached to every email, and emails go out from several routes.
    "/**": ["./public/email/*.png"],
  },
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
