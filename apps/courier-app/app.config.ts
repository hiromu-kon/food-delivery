import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Food Delivery 配達員',
  slug: 'fooddelivery-courier',
  scheme: 'fooddelivery-courier',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: '置き配した場所の写真を撮影するためにカメラを使用します。',
        recordAudioAndroid: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
