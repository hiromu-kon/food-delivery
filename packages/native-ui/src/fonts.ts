import {
  ZenKakuGothicNew_400Regular,
  ZenKakuGothicNew_500Medium,
  ZenKakuGothicNew_700Bold,
} from '@expo-google-fonts/zen-kaku-gothic-new';
import { ZenOldMincho_700Bold } from '@expo-google-fonts/zen-old-mincho';
import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    ZenKakuGothicNew_400Regular,
    ZenKakuGothicNew_500Medium,
    ZenKakuGothicNew_700Bold,
    ZenOldMincho_700Bold,
  });
}
