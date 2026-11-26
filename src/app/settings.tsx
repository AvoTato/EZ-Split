import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLastBackupAt } from '../lib/cloud';
import { clearGroupsLocal } from '../lib/groups';
import { LANGUAGES, useT, localeTag, t } from '../lib/i18n';
import { goBack } from '../lib/navigation';
import { setGroupSettlementSetup, setPickedImage, setSplitSetup } from '../lib/receiptSession';
import { TONES, TONE_LABELS, type Tone } from '../lib/reminders';
import { getSettings, updateSettings, type ThemeChoice } from '../lib/settings';
import { useColors, type Colors } from '../lib/theme';

const SUPPORT_EMAIL = 'support@example.com';


const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function backupLabel(timestamp: number | null) {
  if (!timestamp) return t('Not backed up');
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) return t('Backed up today');
  return t('Backed up {date}', { date: date.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' }) });
}

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  divided?: boolean;
};

function Row({ icon, label, value, onPress, danger, right, divided }: RowProps) {
  const colors = useColors();
  const { PURPLE_DARK, MUTED, RED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const content = (
    <>
      <View style={[styles.tile, danger && styles.tileDanger]}>
        <Ionicons name={icon} size={22} color={danger ? RED : PURPLE_DARK} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: RED }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={20} color={MUTED} /> : null)}
    </>
  );
  if (!onPress) return <View style={[styles.row, divided && styles.rowDivided]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divided && styles.rowDivided, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, PURPLE, INK, BORDER } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [settings, setSettings] = useState(getSettings);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [pickingTone, setPickingTone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSettings(getSettings());
      getLastBackupAt().then(setLastBackupAt);
    }, []),
  );

  const change = (patch: Parameters<typeof updateSettings>[0]) => setSettings({ ...updateSettings(patch) });

  const chooseTone = (tone: Tone) => {
    change({ tone });
    setPickingTone(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      t('Delete all data?'),
      "This removes every group and settlement from this phone. A backup you've already made is not deleted, so you can restore it from Backup & restore.",
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            clearGroupsLocal();
            setGroupSettlementSetup(null);
            setSplitSetup(null);
            setPickedImage(null);
            Alert.alert(t('Deleted'), t('All groups and settlements were removed from this phone.'));
          },
        },
      ],
    );
  };

  const openFeedback = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('EZ-Split feedback')}`).catch(() =>
      Alert.alert(t('No email app'), t('Write to us at {email}.', { email: SUPPORT_EMAIL })),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <Text style={styles.title}>{t('Settings')}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>{t('APPEARANCE')}</Text>
          <View style={styles.card}>
            <Row icon="globe-outline" label={t('Language')} value={LANGUAGES.find((item) => item.code === settings.language)?.native} onPress={() => router.push('/language')} />
            <Row icon="moon-outline" label={t('Theme')} divided />
            <View style={styles.segmented}>
              {THEMES.map((theme) => {
                const active = settings.theme === theme.value;
                return (
                  <Pressable
                    key={theme.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => change({ theme: theme.value })}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(theme.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('REMINDERS')}</Text>
          <View style={styles.card}>
            <Row
              icon="notifications-outline"
              label={t('Default tone')}
              value={t(TONE_LABELS[settings.tone])}
              onPress={() => setPickingTone(true)}
            />
            <Row
              icon="notifications-outline"
              label={t('Nudge me about unpaid bills')}
              divided
              right={
                <Switch
                  accessibilityLabel={t('Nudge me about unpaid bills')}
                  value={settings.nudge}
                  onValueChange={(nudge) => change({ nudge })}
                  trackColor={{ false: BORDER, true: PURPLE }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          </View>

          <Text style={styles.sectionLabel}>{t('DATA')}</Text>
          <View style={styles.card}>
            <Row
              icon="cloud-outline"
              label={t('Backup & restore')}
              value={backupLabel(lastBackupAt)}
              onPress={() => router.push('/backup')}
            />
            <Row icon="trash-outline" label={t('Delete all data')} danger divided onPress={confirmDelete} />
          </View>

          <Text style={styles.sectionLabel}>{t('ABOUT')}</Text>
          <View style={styles.card}>
            <Row icon="help-circle-outline" label={t('Help and feedback')} onPress={openFeedback} />
            <Row icon="shield-outline" label={t('Privacy')} divided onPress={() => router.push('/privacy')} />
          </View>

          <Text style={styles.version}>{t('EZ-Split · Version {version}', { version: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
        </ScrollView>
      </View>

      <Modal visible={pickingTone} transparent animationType="fade" onRequestClose={() => setPickingTone(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickingTone(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t('Default tone')}</Text>
            {TONES.map((tone) => {
              const selected = tone === settings.tone;
              return (
                <Pressable
                  key={tone}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => chooseTone(tone)}
                  style={({ pressed }) => [styles.toneRow, pressed && styles.pressed]}
                >
                  <Text style={[styles.toneText, selected && styles.toneTextSelected]}>{t(TONE_LABELS[tone])}</Text>
                  {selected && <Ionicons name="checkmark" size={22} color={PURPLE_DARK} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, INK, MUTED, BORDER, BG, SURFACE, RED_TINT, OVERLAY  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: MUTED, letterSpacing: 0.4, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 15, minHeight: 62 },
  rowDivided: { borderTopWidth: 1, borderTopColor: BORDER },
  tile: { width: 36, height: 36, borderRadius: 12, backgroundColor: PURPLE_TINT, alignItems: 'center', justifyContent: 'center' },
  tileDanger: { backgroundColor: RED_TINT },
  rowLabel: { flex: 1, fontSize: 17, fontWeight: '800', color: INK },
  rowValue: { fontSize: 16, color: MUTED },
  segmented: { flexDirection: 'row', backgroundColor: PURPLE_TINT, borderRadius: 18, padding: 4, marginHorizontal: 15, marginBottom: 14 },
  segment: { flex: 1, height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: SURFACE, borderColor: BORDER },
  segmentText: { fontSize: 16, fontWeight: '800', color: PURPLE_DARK },
  segmentTextActive: { color: INK },
  version: { textAlign: 'center', fontSize: 14, color: MUTED, marginTop: 20 },
  pressed: { opacity: 0.65 },
  backdrop: { flex: 1, backgroundColor: OVERLAY, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: INK, marginBottom: 6 },
  toneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: BORDER },
  toneText: { fontSize: 17, fontWeight: '700', color: INK },
  toneTextSelected: { color: PURPLE_DARK, fontWeight: '800' },
});
