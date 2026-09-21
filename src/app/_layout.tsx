import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-group-settlement" />
      <Stack.Screen name="upload-receipt" />
      <Stack.Screen name="upload-file" />
      <Stack.Screen name="receipt-processing" />
      <Stack.Screen name="instant-settlement" />
    </Stack>
  );
}
