import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import { useReceiptPicker, type PickedImage } from '../lib/pickReceipt';
import { getPickedImage, setPendingImage, setPickedImage } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';

export default function UploadReceiptScreen() {
  const router = useRouter();
  const [image, setImage] = useState<PickedImage | null>(() => getPickedImage());
  const { pick, sheet } = useReceiptPicker();

  const onPressReceiptBox = async () => {
    const picked = await pick();
    if (!picked) return;
    setPickedImage(picked);
    setImage(picked);
  };

  const handleUpload = () => {
    if (!image) return;
    setPendingImage(image.base64);
    router.push('/receipt-processing');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Upload Receipt</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.receiptBox} onPress={onPressReceiptBox} activeOpacity={0.7}>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={[styles.receiptImage, { aspectRatio: image.width / image.height }]}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.receiptBoxText}>Take/Upload Receipt</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.uploadButton, !image && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={!image}
            activeOpacity={0.7}
          >
            <Text style={styles.uploadButtonText}>Upload</Text>
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
    alignItems: 'center',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  receiptBox: {
    backgroundColor: PILL_GRAY,
    borderRadius: 16,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  receiptBoxText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  receiptImage: {
    width: '100%',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  uploadButton: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
