import type { NextConfig } from "next";
const config: NextConfig = { output: "export", images: { unoptimized: true }, experimental: { cpus: 1 } };
export default config;
