import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callGoogleVisionOCR, parseReceiptText, type ParsedReceipt } from '../lib/parseReceipt';

const PURPLE = '#9B87F0';
const PILL_GRAY = '#EFEFEF';

export default function UploadReceiptScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null);

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setImageBase64(asset.base64 ?? null);
    setParsedReceipt(null);
    setError(null);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Please allow camera access to scan a receipt.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    handleImageResult(result);
  };

  const chooseFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Please allow photo access to upload a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });
    handleImageResult(result);
  };

  const onPressReceiptBox = () => {
    Alert.alert('Add receipt', 'Take a photo or choose one from your library.', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: chooseFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUpload = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const text = await callGoogleVisionOCR(imageBase64);
      setParsedReceipt(parseReceiptText(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong scanning the receipt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Upload Receipt</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.receiptBox} onPress={onPressReceiptBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="cover" />
            ) : (
              <Text style={styles.receiptBoxText}>Take/Upload Receipt</Text>
            )}
          </Pressable>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {parsedReceipt && (
            <View style={styles.results}>
              <Text style={styles.resultsTitle}>Scanned items</Text>
              {parsedReceipt.items.length === 0 && (
                <Text style={styles.resultRowText}>No items detected.</Text>
              )}
              {parsedReceipt.items.map((item, index) => (
                <View key={index} style={styles.resultRow}>
                  <Text style={styles.resultRowText}>{item.name}</Text>
                  <Text style={styles.resultRowText}>{item.price.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.resultsDivider} />
              {parsedReceipt.subtotal !== null && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowText}>Subtotal</Text>
                  <Text style={styles.resultRowText}>{parsedReceipt.subtotal.toFixed(2)}</Text>
                </View>
              )}
              {parsedReceipt.serviceCharge !== null && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowText}>Service charge</Text>
                  <Text style={styles.resultRowText}>{parsedReceipt.serviceCharge.toFixed(2)}</Text>
                </View>
              )}
              {parsedReceipt.tax !== null && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowText}>Tax</Text>
                  <Text style={styles.resultRowText}>{parsedReceipt.tax.toFixed(2)}</Text>
                </View>
              )}
              {parsedReceipt.total !== null && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultRowTotal}>Total</Text>
                  <Text style={styles.resultRowTotal}>{parsedReceipt.total.toFixed(2)}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.uploadButton, !imageBase64 && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={!imageBase64 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Upload</Text>
            )}
          </Pressable>
        </View>
      </View>
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
    height: '100%',
    minHeight: 220,
  },
  errorText: {
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
  },
  results: {
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  resultRowText: {
    fontSize: 15,
    color: '#000',
  },
  resultRowTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  resultsDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
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
