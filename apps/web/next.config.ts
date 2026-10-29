import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@spa-saas/shared', '@spa-saas/ui'],
};

export default config;
