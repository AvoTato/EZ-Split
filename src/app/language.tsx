import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LANGUAGES, useT } from '../lib/i18n';
import { goBack } from '../lib/navigation';
import { updateSettings, useSettings } from '../lib/settings';
import { useColors, type Colors } from '../lib/theme';

export default function LanguageScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { language } = useSettings();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={colors.INK} />
          </Pressable>
          <View>
            <Text style={styles.subtitle}>{t('Settings')}</Text>
            <Text style={styles.title}>{t('Language')}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {LANGUAGES.map((item, index) => {
              const selected = item.code === language;
              return (
                <Pressable
                  key={item.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.native}, ${item.english}`}
                  onPress={() => updateSettings({ language: item.code })}
                  style={({ pressed }) => [styles.row, index > 0 && styles.rowDivided, pressed && styles.pressed]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.native}>{item.native}</Text>
                    <Text style={styles.english}>{item.english}</Text>
                  </View>
                  {selected ? (
                    <View style={styles.radioOn}>
                      <Ionicons name="checkmark" size={20} color={colors.ON_PURPLE} />
                    </View>
                  ) : (
                    <View style={styles.radioOff} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={20} color={colors.PURPLE_DARK} />
            <Text style={styles.noteText}>
              {t('Changes the app language. Group names, members and receipts stay as you typed them.')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE, INK, MUTED, BORDER, BG, SURFACE }: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
    page: { flex: 1, width: '100%', maxWidth: 480 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
    subtitle: { fontSize: 14, fontWeight: '700', color: MUTED },
    title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
    content: { paddingHorizontal: 20, paddingBottom: 32 },
    card: { borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 17, minHeight: 66 },
    rowDivided: { borderTopWidth: 1, borderTopColor: BORDER },
    rowCopy: { flex: 1, minWidth: 0 },
    native: { fontSize: 18, fontWeight: '800', color: INK },
    english: { fontSize: 15, color: MUTED },
    radioOn: { width: 28, height: 28, borderRadius: 14, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
    radioOff: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: BORDER },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, paddingHorizontal: 4 },
    noteText: { flex: 1, fontSize: 15, lineHeight: 21, color: MUTED },
    pressed: { opacity: 0.65 },
  });
