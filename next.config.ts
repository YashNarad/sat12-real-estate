import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    turbopackPluginRuntimeStrategy: "workerThreads",
    serverActions: {
      // Property images are validated again at 5 MiB in the action. The small
      // overhead allowance keeps valid multipart uploads below this hard cap.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mveicefdvdgeyxalgnue.supabase.co",
        pathname: "/storage/v1/object/sign/property-images/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
