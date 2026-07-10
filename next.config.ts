import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    return [
      // Public storefronts live at /@username. "@" at the start of an app/
      // folder name is reserved for Next.js parallel routes, so the actual
      // page lives at /creator/[username] and this rewrite preserves the
      // /@username URL for visitors and internal links.
      {
        source: "/@:username",
        destination: "/creator/:username",
      },
    ];
  },
};

export default nextConfig;
