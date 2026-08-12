import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Trait layer filenames are content-stable — they change only when the
        // art itself is re-imported. Next serves /public with max-age=0.
        source: "/piggy/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
