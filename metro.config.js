const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// Webプラットフォームのビルド時のみ、expo-sqlite をダミーモックに差し替える
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./src/database/expo-sqlite-mock.web.tsx'),
    };
  }
  // それ以外は通常の解決ロジックを使用
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
