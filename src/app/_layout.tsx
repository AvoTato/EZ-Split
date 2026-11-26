import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadGroups } from '../lib/groups';
import { loadSettings } from '../lib/settings';
import { useColors } from '../lib/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const colors = useColors();

  useEffect(() => {
    Promise.all([loadGroups(), loadSettings()]).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.BG } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-group-settlement" />
      <Stack.Screen name="upload-receipt" />
      <Stack.Screen name="upload-file" />
      <Stack.Screen name="receipt-processing" />
      <Stack.Screen name="instant-settlement" />
      <Stack.Screen name="how-many-people" />
      <Stack.Screen name="settlement-summary" />
      <Stack.Screen name="how-split" />
      <Stack.Screen name="who-had-what" />
      <Stack.Screen name="item-quantities" />
      <Stack.Screen name="receipt-history" />
      <Stack.Screen name="group-balances" />
      <Stack.Screen name="create-new-group" />
      <Stack.Screen name="group-members" />
      <Stack.Screen name="backup" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="language" />
    </Stack>
  );
}
