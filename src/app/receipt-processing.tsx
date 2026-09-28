import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callGoogleVisionOCR, parseReceiptText, type ParsedReceipt } from '../lib/parseReceipt';
import { setParsedReceipt, takePendingImage } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const TRACK_GRAY = '#D9D9D9';
const MIN_VISIBLE_MS = 200;

export default function ReceiptProcessingScreen() {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.9,
      duration: 600,
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
      let parsed: ParsedReceipt | null = null;
      try {
        const text = await callGoogleVisionOCR(imageBase64);
        // Left in intentionally: the parser is a heuristic, so seeing the raw OCR text
        // is how we tell "Vision misread the receipt" apart from "the parser missed it."
        console.log('Raw OCR text:\n' + text);
        parsed = parseReceiptText(text);
        console.log('Parsed receipt:', parsed);
        if (parsed.items.length === 0 && parsed.total === null) {
          // Nothing recognizable came out of the text — treat it the same as an OCR failure
          // rather than showing an empty settlement.
          parsed = null;
        }
      } catch (e) {
        console.warn('Receipt OCR failed:', e);
      }

      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(() => {
        if (cancelled) return;

        if (!parsed) {
          // react-native-web's Alert.alert is a no-op, so its onPress (the redirect) would
          // never fire there — use window.alert on web instead, and navigate right after it.
          if (Platform.OS === 'web') {
            window.alert("Couldn't read that receipt. Please try again with a clearer photo.");
            router.replace('/upload-receipt');
          } else {
            Alert.alert(
              "Couldn't read that receipt",
              'Please try again with a clearer photo.',
              [{ text: 'OK', onPress: () => router.replace('/upload-receipt') }]
            );
          }
          return;
        }

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
