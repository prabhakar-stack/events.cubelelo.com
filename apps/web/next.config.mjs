/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as TypeScript source — let Next transpile them.
  transpilePackages: ["@cubers/types", "@cubers/scramble-core", "@cubers/timer-core"],
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
