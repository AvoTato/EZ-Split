import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import { useReceiptPicker } from '../lib/pickReceipt';
import { setPickedImage, setSplitSetup } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_DARK = '#5B3FD8';
const PURPLE_TINT = '#F0ECFD';
const INK = '#1A1530';
const MUTED = '#6B6880';
const TRACK = '#EFECF8';

const TIPS = [
  'Good light, no shadows across the text',
  'Whole receipt in the frame',
  'Tax and total are visible',
];

export default function UploadScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const { pick, pickFrom, sheet } = useReceiptPicker();

  useEffect(() => {
    setPickedImage(null);
    setSplitSetup(null);
  }, []);

  const handlePress = async () => {
    const image = await pick();
    if (!image) return;
    setPickedImage(image);
    router.push('/upload-receipt');
  };

  const handlePickFrom = async (source: 'camera' | 'library') => {
    const image = await pickFrom(source);
    if (!image) return;
    setPickedImage(image);
    router.push('/upload-receipt');
  };

  if (flow === 'group') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable onPress={() => goBack(router)} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#000" />
            </Pressable>
            <Text style={styles.headerTitle}>Create Group Settlement</Text>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.instantPage}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.instantHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBack(router)}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View>
            <Text style={styles.stepLabel}>Instant split · Step 1 of 3</Text>
            <Text style={styles.instantTitle}>Add your receipt</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.dropZone}>
          <View style={styles.dropIcon}>
            <Ionicons name="camera-outline" size={40} color={INK} />
          </View>
          <Text style={styles.dropTitle}>Snap or upload a receipt</Text>
          <Text style={styles.dropHelp}>
            Lay it flat so the items and the total are both in the photo.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => handlePickFrom('camera')}
        >
          <Ionicons name="camera-outline" size={22} color={INK} />
          <Text style={styles.primaryText}>Take photo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => handlePickFrom('library')}
        >
          <Ionicons name="image-outline" size={22} color={PURPLE_DARK} />
          <Text style={styles.secondaryText}>Upload from gallery</Text>
        </Pressable>

        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipCheck}>
                <Ionicons name="checkmark" size={16} color={PURPLE_DARK} />
              </View>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  instantPage: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  instantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
  },
  instantTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: {
    width: '33.333%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
  dropZone: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F7FB',
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
    paddingVertical: 48,
    paddingHorizontal: 28,
    marginBottom: 20,
  },
  dropIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dropTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  dropHelp: {
    fontSize: 16,
    lineHeight: 23,
    color: MUTED,
    textAlign: 'center',
    marginTop: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PURPLE,
    borderRadius: 18,
    paddingVertical: 20,
    marginBottom: 14,
  },
  primaryText: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PURPLE,
    paddingVertical: 18,
  },
  secondaryText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  pressed: {
    opacity: 0.85,
  },
  tips: {
    gap: 16,
    marginTop: 28,
    paddingHorizontal: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tipCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 16,
    color: INK,
  },
});
