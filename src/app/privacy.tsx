import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';


const ITEMS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Your data lives on this phone',
    body: 'Your groups, members and settlements are saved on this phone. There is no account to create.',
  },
  {
    icon: 'camera-outline',
    title: 'Receipt photos',
    body: 'When you scan a receipt, the photo is sent to a text-reading service so the items and totals can be found.',
  },
  {
    icon: 'cloud-outline',
    title: 'Automatic backup',
    body: 'If backup is on, your groups and bills are saved to our backup server under your recovery code. Anyone who has the code can restore that data, so keep it private.',
  },
  {
    icon: 'link-outline',
    title: 'Shared bills',
    body: 'When you share a bill link, the bill (names, amounts and who has paid) is stored so your friends can open it. Deleting a settlement removes its link.',
  },
];

export default function PrivacyScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <Text style={styles.title}>{t('Privacy')}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {ITEMS.map((item) => (
            <View key={t(item.title)} style={styles.card}>
              <View style={styles.tile}>
                <Ionicons name={item.icon} size={22} color={PURPLE_DARK} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{t(item.title)}</Text>
                <Text style={styles.body}>{t(item.body)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_TINT, INK, MUTED, BORDER, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  card: { flexDirection: 'row', gap: 14, padding: 17, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  tile: { width: 36, height: 36, borderRadius: 12, backgroundColor: PURPLE_TINT, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: INK },
  body: { fontSize: 15, lineHeight: 21, color: MUTED },
});
