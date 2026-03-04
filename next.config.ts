import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep these packages as native Node.js requires — do NOT bundle them with webpack.
  //
  // pdf-parse: uses Object.defineProperty on its own exports which webpack can't handle.
  //
  // pptxgenjs + openai: both import node:https internally. When webpack bundles them it creates
  // a chunk named "[externals]_node:https_*.js". On Windows, CopyFile rejects the colon in that
  // filename with EINVAL during `next build --output standalone`. Marking them as external
  // prevents webpack from ever creating that chunk.
  //
  // mammoth + @google/generative-ai: same node: protocol issue; kept external for safety.
  serverExternalPackages: [
    'pdf-parse',
    'pptxgenjs',
    'openai',
    'mammoth',
    '@google/generative-ai',
  ],
  // Allow ngrok tunnel + localhost origins in dev (suppresses cross-origin warnings)
  allowedDevOrigins: [
    'vaniai.ngrok.app',
    '127.0.0.1',
    'localhost',
  ],
  // Prevent ngrok from caching HTML responses that include versioned CSS/JS URLs.
  // Without this, a cached HTML page will request old CSS filenames after HMR recompiles.
  async headers() {
    return process.env.NODE_ENV === 'development'
      ? [{ source: '/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] }]
      : [];
  },
  // Next.js 16: Turbopack is the default dev bundler. No custom Turbopack config needed —
  // the empty object silences the "webpack config present but no turbopack config" error.
  turbopack: {},
  // Suppress webpack cache serialization warning (large strings in PackFileCacheStrategy).
  // Only applies during `next build` (production) which still uses webpack.
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /./, message: /Serializing big strings.*PackFileCacheStrategy/ },
    ];
    return config;
  },
};

export default nextConfig;
