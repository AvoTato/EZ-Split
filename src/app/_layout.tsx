import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadGroups } from '../lib/groups';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadGroups().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-group-settlement" />
      <Stack.Screen name="upload-receipt" />
      <Stack.Screen name="upload-file" />
      <Stack.Screen name="receipt-processing" />
      <Stack.Screen name="instant-settlement" />
      <Stack.Screen name="settlement-summary" />
      <Stack.Screen name="who-had-what" />
      <Stack.Screen name="item-quantities" />
      <Stack.Screen name="receipt-history" />
      <Stack.Screen name="group-balances" />
      <Stack.Screen name="create-new-group" />
      <Stack.Screen name="group-members" />
    </Stack>
  );
}
