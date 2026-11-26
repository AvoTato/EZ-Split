import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { groupStep, isGroupFlow } from '../lib/flowSteps';
import { goBack } from '../lib/navigation';
import { useReceiptPicker, type PickedImage } from '../lib/pickReceipt';
import { getPickedImage, setPendingImage, setPickedImage } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';


export default function UploadReceiptScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [image, setImage] = useState<PickedImage | null>(() => getPickedImage());
  const { pick, sheet } = useReceiptPicker();
  const isGroup = isGroupFlow();

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
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View>
            {isGroup && <Text style={styles.stepLabel}>{groupStep(2).label}</Text>}
            <Text style={styles.title}>{t('Upload receipt')}</Text>
          </View>
        </View>

        {isGroup && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: groupStep(2).fill }]} />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.receiptBox, pressed && styles.pressed]}
            onPress={onPressReceiptBox}
          >
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={[styles.receiptImage, { aspectRatio: image.width / image.height }]}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.receiptBoxText}>{t('Take/Upload Receipt')}</Text>
            )}
          </Pressable>
          {image && (
            <Pressable accessibilityRole="button" onPress={onPressReceiptBox} style={styles.retake}>
              <Ionicons name="refresh" size={20} color={PURPLE_DARK} />
              <Text style={styles.retakeText}>{t('Choose a different photo')}</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.uploadButton, !image && styles.uploadButtonDisabled, pressed && styles.pressed]}
            onPress={handleUpload}
            disabled={!image}
          >
            <Text style={styles.uploadButtonText}>{t('Upload')}</Text>
          </Pressable>
        </View>
      </View>
      {sheet}
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, PANEL, BG  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: MUTED },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: TRACK, overflow: 'hidden', marginHorizontal: 20, marginBottom: 16 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: PURPLE },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  receiptBox: {
    backgroundColor: PANEL,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  receiptBoxText: { fontSize: 18, fontWeight: '800', color: PURPLE_DARK },
  receiptImage: { width: '100%' },
  retake: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  retakeText: { fontSize: 16, fontWeight: '800', color: PURPLE_DARK },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: BORDER },
  uploadButton: { backgroundColor: PURPLE, borderRadius: 18, paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { fontSize: 18, fontWeight: '800', color: ON_PURPLE },
  pressed: { opacity: 0.85 },
});
