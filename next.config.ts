/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const repo = "tools";

const nextConfig = {
  output: "export", // 静的書き出し（out/）
  trailingSlash: true, // /about/ 形式で出して 404 を避ける
  images: { unoptimized: true },
  basePath: isProd ? `/${repo}` : "",
  assetPrefix: isProd ? `/${repo}/` : "",
  // App Routerで完全静的にしたい場合の安全網（必要に応じて）
  experimental: { turbo: { rules: {} } },
};

export default nextConfig;
