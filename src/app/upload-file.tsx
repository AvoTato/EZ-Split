import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReceiptPicker } from '../lib/pickReceipt';
import { setPickedImage } from '../lib/receiptSession';

export default function UploadScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const { pick, sheet } = useReceiptPicker();

  // Start each run fresh so a previous receipt never shows up on the next one.
  useEffect(() => {
    setPickedImage(null);
  }, []);

  const handlePress = async () => {
    const image = await pick();
    if (!image) return;
    setPickedImage(image);
    router.push('/upload-receipt');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {flow === 'group' ? 'Create Group Settlement' : 'Instant Settlement'}
          </Text>
        </View>

        <View style={styles.container}>
          <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.7}>
            <Text style={styles.buttonText}>Take/Upload Receipt</Text>
          </TouchableOpacity>
        </View>
      </View>
      {sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 300,
    height: 150,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
});
