const nextConfig = {
  eslint: {
    // 🚀 本番ビルド時に ESLint エラーで失敗しない（暫定）
    // ignoreDuringBuilds: true,
  },
  // （TypeScriptの型エラーが残ってる場合は↓も一時ON）
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
