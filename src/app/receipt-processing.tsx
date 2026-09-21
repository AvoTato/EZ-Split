import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callGoogleVisionOCR, parseReceiptText, type ParsedReceipt } from '../lib/parseReceipt';
import { setParsedReceipt, takePendingImage } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const TRACK_GRAY = '#D9D9D9';
const MIN_VISIBLE_MS = 350;

// OCR scanning isn't functional yet, so we fall back to this example receipt
// (matching the design mockup) whenever the real call fails.
const DUMMY_RECEIPT: ParsedReceipt = {
  items: [
    { name: 'Chicken Rice', price: 12 },
    { name: 'Nasi Lemak', price: 10 },
    { name: 'Fries', price: 8 },
    { name: 'Drinks', price: 10 },
  ],
  subtotal: 40,
  serviceCharge: 4,
  tax: 2,
  total: 46,
};

export default function ReceiptProcessingScreen() {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.9,
      duration: 900,
      useNativeDriver: false,
    }).start();

    const imageBase64 = takePendingImage();
    if (!imageBase64) {
      router.replace('/upload-receipt');
      return;
    }

    const startedAt = Date.now();
    let cancelled = false;

    (async () => {
      let parsed: ParsedReceipt;
      try {
        const text = await callGoogleVisionOCR(imageBase64);
        parsed = parseReceiptText(text);
      } catch (e) {
        // OCR isn't functional yet — fall back to example data so the rest of the flow is usable.
        parsed = DUMMY_RECEIPT;
      }

      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        Animated.timing(progress, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }).start(() => {
          if (cancelled) return;
          setParsedReceipt(parsed);
          router.replace('/instant-settlement');
        });
      }, remaining);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const widthInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/ezsplit-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.text}>Processing Receipt Data....</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: widthInterpolate }]} />
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
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 24,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK_GRAY,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
});
