import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

const PURPLE = '#9855FF';
const MUTED = '#696171';
const GREEN = '#2E7D32';
const RED = '#B42318';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

function describeError(error: unknown, action: 'backup' | 'restore') {
  if (error instanceof CloudError) {
    if (action === 'restore' && (error.status === 401 || error.status === 404)) {
      return 'No backup was found for that code. Check it and try again.';
    }
    if (error.code === 'network' || error.code === 'timeout') {
      return "Couldn't reach the server. Check your connection and try again.";
    }
    if (error.status === 429) return 'Too many tries. Wait a minute and try again.';
  }
  return action === 'backup' ? "Couldn't back up right now. Try again shortly." : "Couldn't restore right now. Try again shortly.";
}

function formatWhen(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BackupScreen() {
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
      setBackupNotice({ tone: 'ok', text: 'Backed up.' });
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
      setBackupNotice({ tone: 'ok', text: 'Recovery code copied.' });
    } catch {
      setBackupNotice({ tone: 'error', text: "Couldn't copy. Write the code down instead." });
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
      setRestoreNotice({ tone: 'ok', text: `Restored ${count} ${count === 1 ? 'group' : 'groups'}.` });
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
            accessibilityLabel="Go back"
            onPress={() => goBack(router, '/(tabs)/groups')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={28} color="#191919" />
          </Pressable>
          <Text style={styles.headerTitle}>Backup</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!configured ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Backup isn&apos;t set up</Text>
              <Text style={styles.body}>
                This build has no server address, so your data stays on this phone only.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Automatic backup</Text>
                <Text style={styles.body}>
                  Your groups and bills are backed up a few seconds after each change. No account needed.
                </Text>
                <Text style={styles.status}>
                  {lastBackupAt ? `Last backed up ${formatWhen(lastBackupAt)}` : 'Not backed up yet'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={backingUp}
                  onPress={handleBackup}
                  style={({ pressed }) => [styles.primaryButton, (pressed || backingUp) && styles.pressed]}
                >
                  {backingUp ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Back up now</Text>
                  )}
                </Pressable>
                {backupNotice && (
                  <Text style={[styles.notice, backupNotice.tone === 'error' && styles.noticeError]}>
                    {backupNotice.text}
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your recovery code</Text>
                <Text style={styles.body}>
                  Write this down somewhere safe. It&apos;s the only way to get your data back on a new phone, and
                  anyone who has it can restore your data.
                </Text>
                {code ? (
                  <>
                    <Text selectable={showCode} style={styles.code} accessibilityLabel={showCode ? code : 'Hidden code'}>
                      {showCode ? code : code.replace(/[^-]/g, '•')}
                    </Text>
                    <View style={styles.row}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowCode((value) => !value)}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.secondaryButtonText}>{showCode ? 'Hide' : 'Show code'}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={handleCopy}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.secondaryButtonText}>Copy</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text style={styles.status}>You&apos;ll get a code after your first backup.</Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Restore from a code</Text>
                <Text style={styles.body}>
                  Moving from another phone? Enter its recovery code to bring your groups and bills here.
                </Text>
                <TextInput
                  accessibilityLabel="Recovery code"
                  style={styles.input}
                  value={restoreInput}
                  onChangeText={(text) => {
                    setRestoreInput(text);
                    setConfirmingRestore(false);
                    setRestoreNotice(null);
                  }}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  placeholderTextColor="#A49EAD"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={48}
                />
                {confirmingRestore ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmText}>
                      This replaces everything on this phone with the backup. This phone&apos;s current code will stop
                      being used.
                    </Text>
                    <View style={styles.row}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setConfirmingRestore(false)}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
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
                          <Text style={styles.primaryButtonText}>Replace my data</Text>
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
                    style={({ pressed }) => [styles.primaryButton, (pressed || !codeReady) && styles.pressed]}
                  >
                    <Text style={styles.primaryButtonText}>Restore</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 20, gap: 10 },
  backButton: { minWidth: 30, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 32, fontWeight: '600', color: '#171717' },
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 20 },
  card: { backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: '#E6E3EE', borderRadius: 20, padding: 20, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '600', color: '#171717' },
  body: { fontSize: 15, lineHeight: 21, color: MUTED },
  status: { fontSize: 15, fontWeight: '600', color: '#171717' },
  code: {
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 1,
    color: '#171717',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E6E3EE',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#222',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  primaryButton: { minHeight: 48, borderRadius: 16, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryButton: { minHeight: 44, borderRadius: 14, backgroundColor: '#EFEFEF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: '#171717' },
  dangerButton: { minHeight: 44, borderRadius: 14, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, flexGrow: 1 },
  confirmBox: { backgroundColor: '#FFF0EE', borderRadius: 14, padding: 14, gap: 12 },
  confirmText: { fontSize: 14, lineHeight: 20, color: RED, fontWeight: '600' },
  notice: { fontSize: 14, fontWeight: '600', color: GREEN },
  noticeError: { color: RED },
  pressed: { opacity: 0.65 },
});
