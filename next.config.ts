import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The dev server only serves its scripts to localhost by default; this lets
  // the page work when opened as http://127.0.0.1:3000 too.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
