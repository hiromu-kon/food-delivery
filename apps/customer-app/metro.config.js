// Expo の Metro 設定は CommonJS で読み込まれるため、TypeScript ではなく JS で書く。
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// withUniwindConfig はほかの設定より外側に置く必要がある（Uniwind の制約）。
module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
