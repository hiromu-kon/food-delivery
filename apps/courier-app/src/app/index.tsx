import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="bg-base flex-1 items-center justify-center">
      <Stack.Screen options={{ title: '配達' }} />
      <Text className="text-heading-l text-brand">Food Delivery 配達員</Text>
    </View>
  );
}
