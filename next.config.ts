import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // @remotion/renderer and @remotion/bundler dynamically `require()`
  // platform-specific native compositor/Chromium packages at runtime.
  // Bundling them would make the build try to statically resolve every
  // platform's optional package (most of which aren't installed) — keep
  // them external so Node resolves only the current platform's package.
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
};

export default nextConfig;
