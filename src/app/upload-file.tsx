import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { groupStep } from '../lib/flowSteps';
import { goBack } from '../lib/navigation';
import { useReceiptPicker } from '../lib/pickReceipt';
import { setPickedImage, setSplitSetup } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';


const TIPS = [
  'Good light, no shadows across the text',
  'Whole receipt in the frame',
  'Tax and total are visible',
];

export default function UploadScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const isGroup = flow === 'group';
  const { pickFrom } = useReceiptPicker();

  useEffect(() => {
    setPickedImage(null);
    setSplitSetup(null);
  }, []);

  const handlePickFrom = async (source: 'camera' | 'library') => {
    const image = await pickFrom(source);
    if (!image) return;
    setPickedImage(image);
    router.push('/upload-receipt');
  };

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
            accessibilityLabel={t('Go back')}
            onPress={() => goBack(router)}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View>
            <Text style={styles.stepLabel}>{isGroup ? groupStep(2).label : t('Instant split · Step {n} of 3', { n: 1 })}</Text>
            <Text style={styles.instantTitle}>{t('Add your receipt')}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, isGroup && { width: groupStep(2).fill }]} />
        </View>

        <View style={styles.dropZone}>
          <View style={styles.dropIcon}>
            <Ionicons name="camera-outline" size={40} color={colors.ON_PURPLE} />
          </View>
          <Text style={styles.dropTitle}>{t('Snap or upload a receipt')}</Text>
          <Text style={styles.dropHelp}>{t('Lay it flat so the items and the total are both in the photo.')}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => handlePickFrom('camera')}
        >
          <Ionicons name="camera-outline" size={22} color={colors.ON_PURPLE} />
          <Text style={styles.primaryText}>{t('Take photo')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => handlePickFrom('library')}
        >
          <Ionicons name="image-outline" size={22} color={PURPLE_DARK} />
          <Text style={styles.secondaryText}>{t('Upload from gallery')}</Text>
        </Pressable>

        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipCheck}>
                <Ionicons name="checkmark" size={16} color={PURPLE_DARK} />
              </View>
              <Text style={styles.tipText}>{t(tip)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, TRACK, PANEL, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: PANEL,
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
    color: ON_PURPLE,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SURFACE,
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
