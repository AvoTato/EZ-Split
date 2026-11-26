import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloudError, getLastBackupAt, getRecoveryCode, isCloudConfigured, restoreFromCode } from '../lib/cloud';
import { backupGroupsNow, restoreGroups } from '../lib/groups';
import { goBack } from '../lib/navigation';
import { isValidCode } from '../lib/recoveryCode';
import { useColors, type Colors } from '../lib/theme';
import { useT, t, localeTag } from '../lib/i18n';


type Notice = { tone: 'ok' | 'error'; text: string } | null;

function describeError(error: unknown, action: 'backup' | 'restore') {
  if (error instanceof CloudError) {
    if (action === 'restore' && (error.status === 401 || error.status === 404)) {
      return t('No backup was found for that code. Check it and try again.');
    }
    if (error.code === 'network' || error.code === 'timeout') {
      return t("Couldn't reach the server. Check your connection and try again.");
    }
    if (error.status === 429) return t('Too many tries. Wait a minute and try again.');
  }
  return action === 'backup' ? t("Couldn't back up right now. Try again shortly.") : t("Couldn't restore right now. Try again shortly.");
}

function formatWhen(timestamp: number) {
  const date = new Date(timestamp);
  const time = date
    .toLocaleTimeString(localeTag(), { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?(AM|PM)/, (_, half: string) => ` ${half.toLowerCase()}`);
  if (date.toDateString() === new Date().toDateString()) return t('today, {time}', { time });
  const day = date.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

export default function BackupScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, AMBER } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const configured = isCloudConfigured();
  const [code, setCode] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<Notice>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<Notice>(null);

  const refresh = useCallback(() => {
    getRecoveryCode().then(setCode);
    getLastBackupAt().then(setLastBackupAt);
  }, []);

  useFocusEffect(refresh);

  const handleBackup = async () => {
    if (backingUp) return;
    setBackingUp(true);
    setBackupNotice(null);
    try {
      await backupGroupsNow();
      setBackupNotice({ tone: 'ok', text: t('Backed up.') });
    } catch (error) {
      setBackupNotice({ tone: 'error', text: describeError(error, 'backup') });
    } finally {
      setBackingUp(false);
      refresh();
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setBackupNotice({ tone: 'ok', text: t('Recovery code copied.') });
    } catch {
      setBackupNotice({ tone: 'error', text: t("Couldn't copy. Write the code down instead.") });
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setRestoreNotice(null);
    try {
      const data = await restoreFromCode(restoreInput);
      const count = restoreGroups(data);
      setRestoreInput('');
      setConfirmingRestore(false);
      setShowCode(false);
      setRestoreNotice({ tone: 'ok', text: count === 1 ? t('Restored 1 group.') : t('Restored {n} groups.', { n: count }) });
    } catch (error) {
      setConfirmingRestore(false);
      setRestoreNotice({ tone: 'error', text: describeError(error, 'restore') });
    } finally {
      setRestoring(false);
      refresh();
    }
  };

  const codeReady = isValidCode(restoreInput);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Go back')}
            onPress={() => goBack(router, '/(tabs)/groups')}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('Backup & restore')}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!configured ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("Backup isn't set up")}</Text>
              <Text style={styles.body}>{t('This build has no server address, so your data stays on this phone only.')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.tile}>
                    <Ionicons name="cloud-outline" size={24} color={PURPLE_DARK} />
                  </View>
                  <View style={styles.headCopy}>
                    <Text style={styles.cardTitle}>{t('Automatic backup')}</Text>
                    {lastBackupAt ? (
                      <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.status}>{t('Last backed up {when}', { when: formatWhen(lastBackupAt) })}</Text>
                      </View>
                    ) : (
                      <Text style={styles.body}>{t('Not backed up yet')}</Text>
                    )}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={backingUp}
                  onPress={handleBackup}
                  style={({ pressed }) => [styles.primaryButton, (pressed || backingUp) && styles.pressed]}
                >
                  {backingUp ? (
                    <ActivityIndicator color={colors.ON_PURPLE} />
                  ) : (
                    <Text style={styles.primaryButtonText}>{t('Back up now')}</Text>
                  )}
                </Pressable>
                {backupNotice && (
                  <Text style={[styles.notice, backupNotice.tone === 'error' && styles.noticeError]}>
                    {backupNotice.text}
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.tile}>
                    <Ionicons name="key-outline" size={24} color={PURPLE_DARK} />
                  </View>
                  <View style={styles.headCopy}>
                    <Text style={styles.cardTitle}>{t('Your recovery code')}</Text>
                    <Text style={styles.body}>{t('Keep it safe. It restores your groups on a new phone.')}</Text>
                  </View>
                </View>
                {code ? (
                  <>
                    <Text selectable={showCode} style={styles.code} accessibilityLabel={showCode ? code : 'Hidden code'}>
                      {showCode ? code : code.replace(/[^-]/g, '•')}
                    </Text>
                    <View style={styles.row}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowCode((value) => !value)}
                        style={({ pressed }) => [styles.outlineButton, styles.flexButton, pressed && styles.pressed]}
                      >
                        <Ionicons name={showCode ? 'eye-off-outline' : 'eye-outline'} size={22} color={PURPLE_DARK} />
                        <Text style={styles.outlineButtonText}>{showCode ? 'Hide' : 'Show code'}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={handleCopy}
                        style={({ pressed }) => [styles.outlineButton, styles.flexButton, pressed && styles.pressed]}
                      >
                        <Ionicons name="copy-outline" size={22} color={PURPLE_DARK} />
                        <Text style={styles.outlineButtonText}>{t('Copy')}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text style={styles.status}>{t("You'll get a code after your first backup.")}</Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('Restore from a code')}</Text>
                <TextInput
                  accessibilityLabel={t('Recovery code')}
                  style={styles.input}
                  value={restoreInput}
                  onChangeText={(text) => {
                    setRestoreInput(text);
                    setConfirmingRestore(false);
                    setRestoreNotice(null);
                  }}
                  placeholder={t('XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX')}
                  placeholderTextColor={colors.MUTED}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={48}
                />
                <View style={styles.warning}>
                  <Ionicons name="warning-outline" size={22} color={AMBER} />
                  <Text style={styles.warningText}>{t('Restoring replaces the groups on this phone.')}</Text>
                </View>
                {confirmingRestore ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmText}>{t("This replaces everything on this phone with the backup. This phone's current code will stop being used.")}</Text>
                    <View style={styles.row}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setConfirmingRestore(false)}
                        style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.outlineButtonText}>{t('Cancel')}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={restoring}
                        onPress={handleRestore}
                        style={({ pressed }) => [styles.dangerButton, (pressed || restoring) && styles.pressed]}
                      >
                        {restoring ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.dangerButtonText}>{t('Replace my data')}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !codeReady }}
                    disabled={!codeReady}
                    onPress={() => setConfirmingRestore(true)}
                    style={({ pressed }) => [styles.outlineButton, (pressed || !codeReady) && styles.pressed]}
                  >
                    <Text style={styles.outlineButtonText}>{t('Restore')}</Text>
                  </Pressable>
                )}
                {restoreNotice && (
                  <Text style={[styles.notice, restoreNotice.tone === 'error' && styles.noticeError]}>
                    {restoreNotice.text}
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, PANEL, BG, SURFACE, GREEN, AMBER_TINT, AMBER, RED_TINT, RED  }: Colors) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  headerTitle: { flex: 1, fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 14 },
  card: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 24, padding: 17, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 44, height: 44, borderRadius: 14, backgroundColor: PURPLE_TINT, alignItems: 'center', justifyContent: 'center' },
  headCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 20, color: MUTED },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  status: { fontSize: 15, fontWeight: '800', color: GREEN },
  code: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 1,
    textAlign: 'center',
    color: INK,
    fontFamily: MONO,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 14,
    color: INK,
    fontFamily: MONO,
  },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: AMBER_TINT, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  warningText: { flex: 1, fontSize: 15, color: AMBER },
  primaryButton: { alignSelf: 'flex-start', height: 52, borderRadius: 18, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, minWidth: 130 },
  primaryButtonText: { fontSize: 18, fontWeight: '800', color: ON_PURPLE },
  outlineButton: { alignSelf: 'flex-start', height: 48, flexDirection: 'row', gap: 8, borderRadius: 18, borderWidth: 2, borderColor: PURPLE, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  flexButton: { flex: 1, alignSelf: 'stretch' },
  outlineButtonText: { fontSize: 17, fontWeight: '800', color: PURPLE_DARK },
  dangerButton: { height: 48, borderRadius: 18, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, flexGrow: 1 },
  dangerButtonText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  confirmBox: { backgroundColor: RED_TINT, borderRadius: 16, padding: 14, gap: 12 },
  confirmText: { fontSize: 14, lineHeight: 20, color: RED, fontWeight: '700' },
  notice: { fontSize: 14, fontWeight: '800', color: GREEN },
  noticeError: { color: RED },
  pressed: { opacity: 0.65 },
});
