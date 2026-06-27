const API_URL = process.env.API_URL ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as TypeScript source — let Next transpile them.
  transpilePackages: ["@cubers/types", "@cubers/scramble-core", "@cubers/timer-core"],
  async rewrites() {
    return [
      { source: "/health", destination: `${API_URL}/health` },
      { source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` },
    ];
  },
  webpack: (config) => {
    // Our TS sources use ESM-style ".js" import specifiers that actually point at
    // ".ts" files. Teach webpack to resolve them.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
