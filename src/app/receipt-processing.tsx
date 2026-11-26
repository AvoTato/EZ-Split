import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScanError, parseReceiptImage } from '../lib/api';
import { groupStep, isGroupFlow } from '../lib/flowSteps';
import {
  callGoogleVisionOCR,
  foldNegativeLines,
  parseReceiptText,
  type ParsedReceipt,
} from '../lib/parseReceipt';
import { checkReceipt, repairTotal } from '../lib/receiptReview';
import { setParsedReceipt, takePendingImage } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const MIN_VISIBLE_MS = 200;
const CARD_HEIGHT = 280;
const STEP_MS = 1000;
const LAST_PENDING_STEP = 2;

const STEPS = [
  'Receipt uploaded',
  'Items found',
  'Checking tax and service charge',
  'Matching the total',
];

const SKELETON_ROWS = [
  { top: 22, left: 56, width: 88, height: 14 },
  { top: 54, left: 20, width: 180, height: 10 },
  { top: 80, left: 20, width: 132, height: 10 },
  { top: 106, left: 20, width: 150, height: 10 },
  { top: 132, left: 20, width: 104, height: 10 },
  { top: 190, left: 20, width: 96, height: 10 },
  { top: 216, left: 20, width: 100, height: 10 },
  { top: 242, left: 20, width: 178, height: 10 },
];

function Spinner() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />;
}

function StepIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  const colors = useColors();
  const { GREEN } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (state === 'done') {
    return (
      <View style={styles.stepDone}>
        <Ionicons name="checkmark" size={18} color={GREEN} />
      </View>
    );
  }
  if (state === 'active') return <Spinner />;
  return <View style={styles.stepPending} />;
}

export default function ReceiptProcessingScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [progress] = useState(() => new Animated.Value(0));
  const [scan] = useState(() => new Animated.Value(0));
  const cancelledRef = useRef(false);
  const [activeStep, setActiveStep] = useState(LAST_PENDING_STEP - 1);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    sweep.start();
    const timer = setTimeout(() => setActiveStep(LAST_PENDING_STEP), STEP_MS);
    return () => {
      sweep.stop();
      clearTimeout(timer);
    };
  }, [scan]);

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
    cancelledRef.current = false;

    (async () => {
      let parsed: ParsedReceipt | null = null;
      try {
        const raw = await parseReceiptImage(imageBase64);
        const scanned = repairTotal({ ...raw, items: foldNegativeLines(raw.items) });
        parsed = {
          ...scanned,
          needsReview: checkReceipt(scanned).some((issue) => issue.severity === 'warning'),
        };
      } catch (e) {
        console.warn('Receipt scan failed, falling back to OCR:', e instanceof ScanError ? e.code : e);
      }

      if (!parsed) {
        try {
          const ocr = await callGoogleVisionOCR(imageBase64);
          // Left in intentionally: the parser is a heuristic, so seeing the raw OCR text
          // is how we tell "Vision misread the receipt" apart from "the parser missed it."
          console.log('Raw OCR text:\n' + ocr.text);
          console.log('Rebuilt OCR rows:\n' + ocr.rowsText);
          let fromText = parseReceiptText(ocr.rowsText ?? ocr.text);
          if (ocr.rowsText && fromText.items.length === 0 && fromText.total === null) {
            fromText = parseReceiptText(ocr.text);
          }
          const repaired = repairTotal(fromText);
          parsed =
            repaired === fromText
              ? fromText
              : { ...repaired, needsReview: checkReceipt(repaired).some((issue) => issue.severity === 'warning') };
          console.log('Parsed receipt:', parsed);
          if (parsed.items.length === 0 && parsed.total === null) {
            // Nothing recognizable came out of the text — treat it the same as an OCR failure
            // rather than showing an empty settlement.
            parsed = null;
          }
        } catch (e) {
          console.warn('Receipt OCR failed:', e);
        }
      }

      if (cancelledRef.current) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(() => {
        if (cancelledRef.current) return;

        if (!parsed) {
          // react-native-web's Alert.alert is a no-op, so its onPress (the redirect) would
          // never fire there — use window.alert on web instead, and navigate right after it.
          if (Platform.OS === 'web') {
            window.alert(`${t("Couldn't read that receipt")}. ${t('Please try again with a clearer photo.')}`);
            router.replace('/upload-receipt');
          } else {
            Alert.alert(
              t("Couldn't read that receipt"),
              t('Please try again with a clearer photo.'),
              [{ text: t('OK'), onPress: () => router.replace('/upload-receipt') }]
            );
          }
          return;
        }

        setFinished(true);
        Animated.timing(progress, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }).start(() => {
          if (cancelledRef.current) return;
          setParsedReceipt(parsed);
          router.replace('/instant-settlement');
        });
      }, remaining);
    })();

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const widthInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const cancel = () => {
    cancelledRef.current = true;
    router.replace(isGroupFlow() ? '/upload-file?flow=group' : '/upload-file');
  };

  const bandY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_HEIGHT - 70] });

  const stepState = (index: number) => {
    if (finished || index < activeStep) return 'done' as const;
    if (index === activeStep) return 'active' as const;
    return 'pending' as const;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View>
          <Text style={styles.stepLabel}>{isGroupFlow() ? groupStep(2).label : t('Instant split · Step {n} of 3', { n: 1 })}</Text>
          <Text style={styles.title}>{t('Reading your receipt')}</Text>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: widthInterpolate }]} />
        </View>

        <View style={styles.card}>
          {SKELETON_ROWS.map((row) => (
            <View key={row.top} style={[styles.skeleton, row]} />
          ))}
          <Animated.View style={[styles.band, { transform: [{ translateY: bandY }] }]}>
            <View style={styles.bandLine} />
          </Animated.View>
        </View>

        <Text style={styles.hangTight}>{t('Hang tight')}</Text>
        <Text style={styles.help}>{t('We are reading the items and prices. You will check them next.')}</Text>

        <View style={styles.steps}>
          {STEPS.map((label, index) => {
            const state = stepState(index);
            return (
              <View key={label} style={styles.stepRow}>
                <StepIcon state={state} />
                <Text style={[styles.stepText, state === 'pending' && styles.stepTextPending]}>{t(label)}</Text>
              </View>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" onPress={cancel} hitSlop={12} style={styles.cancel}>
          <Text style={styles.cancelText}>{t('Cancel')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE, INK, MUTED, BORDER, TRACK, BG, SURFACE, GREEN_TINT, SKELETON  }: Colors) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.6,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 28,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
  card: {
    alignSelf: 'center',
    width: 220,
    height: CARD_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  skeleton: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: SKELETON,
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(155, 135, 240, 0.12)',
  },
  bandLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PURPLE,
  },
  hangTight: {
    fontSize: 26,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 28,
  },
  help: {
    fontSize: 16,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  steps: {
    gap: 16,
    marginTop: 28,
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepDone: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GREEN_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: TRACK,
    borderTopColor: PURPLE,
    borderRightColor: PURPLE,
  },
  stepPending: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: TRACK,
  },
  stepText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },
  stepTextPending: {
    color: MUTED,
  },
  cancel: {
    marginTop: 'auto',
    alignSelf: 'center',
    paddingVertical: 24,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
});
