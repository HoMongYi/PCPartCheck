import type { NextConfig } from 'next';

const standaloneOutput = process.env.PCPARTCHECK_STANDALONE === 'true'
  ? { output: 'standalone' as const }
  : {};

const nextConfig: NextConfig = {
  ...standaloneOutput,
  poweredByHeader: false,
};

export default nextConfig;
