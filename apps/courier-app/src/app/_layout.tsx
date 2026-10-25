import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// 認証状態による画面の出し分けはページごとではなくこの layout に置く（画面追加時の検査漏れを防ぐ）。
export default function RootLayout() {
  return (
    <>
      <Stack />
      <StatusBar style="auto" />
    </>
  );
}
