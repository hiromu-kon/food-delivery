import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="bg-base flex-1 items-center justify-center">
      <Stack.Screen options={{ title: 'ホーム' }} />
      <Text className="text-heading-l text-brand">Food Delivery</Text>
    </View>
  );
}
