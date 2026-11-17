import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { rewriteReminder } from '../lib/api';
import { createShare, isCloudConfigured, shareUrl } from '../lib/cloud';
import { CURRENCY, money } from '../lib/format';
import type { SettlementSummarySession } from '../lib/receiptSession';
import { TONES, TONE_LABELS, buildReminder, type Tone } from '../lib/reminders';
import { billSnapshot, withShareLink } from '../lib/shareBill';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#F1EDFD';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';
const WHATSAPP_GREEN = '#25D366';
const MESSAGES_BLUE = '#007AFF';
const COPIED_GREEN = '#2E7D32';

function buildShareText(session: SettlementSummarySession) {
  const lines = session.people.map((person) => {
    const fees = person.breakdown ? person.breakdown.serviceCharge + person.breakdown.tax : 0;
    const feeNote = fees > 0 ? ` (incl. ${money(fees)} tax & service)` : '';
    return `${person.name}: ${money(person.amount)}${feeNote}`;
  });
  const total = session.people.reduce((sum, person) => sum + person.amount, 0);
  return ['Settlement Summary', ...lines, `Total: ${money(total)}`].join('\n');
}

type Props = {
  visible: boolean;
  onClose: () => void;
  session: SettlementSummarySession;
  title?: string;
  remindOnly?: boolean;
  // When given, the bill gets a share link the first time the share view opens,
  // and the new link's id is handed back so the caller can save it with the bill.
  onShareId?: (shareId: string) => void;
};

type Mode = 'share' | 'remind';

const AI_AVAILABLE = Boolean(process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_TOKEN);

export default function ShareBillModal({ visible, onClose, session, title, remindOnly = false, onShareId }: Props) {
  const [chosenMode, setMode] = useState<Mode>('share');
  const mode: Mode = remindOnly ? 'remind' : chosenMode;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>('friendly');
  const [edited, setEdited] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  // After a failed attempt, share as plain text instead of retrying on every render.
  const [linkFailed, setLinkFailed] = useState(false);
  const creatingRef = useRef(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const link = session.shareId ? shareUrl(session.shareId) : null;
  const wantsLink = visible && mode === 'share' && Boolean(onShareId) && isCloudConfigured();

  useEffect(() => {
    if (!wantsLink || session.shareId || linkFailed || creatingRef.current || !onShareId) return;
    creatingRef.current = true;
    setCreatingLink(true);
    createShare(billSnapshot(session, title, CURRENCY), session.settledIds ?? [])
      .then(onShareId)
      .catch(() => setLinkFailed(true))
      .finally(() => {
        creatingRef.current = false;
        setCreatingLink(false);
      });
  }, [wantsLink, session, title, linkFailed, onShareId]);

  // A failed link gets another try the next time the sheet opens.
  const close = () => {
    setLinkFailed(false);
    onClose();
  };

  const payer = session.people.find((person) => person.id === session.paidBy);
  const candidates = session.people.filter(
    (person) =>
      person.id !== payer?.id && person.amount > 0 && !session.settledIds?.includes(person.id),
  );
  const target = candidates.find((person) => person.id === selectedId) ?? candidates[0];
  const template = target
    ? buildReminder(tone, {
        name: target.name,
        amountLabel: money(target.amount),
        title,
        payerName: payer?.name,
      })
    : '';
  const reminderText = edited ?? template;

  const shareText = withShareLink(mode === 'remind' ? reminderText : buildShareText(session), link);
  const total = session.people.reduce((sum, person) => sum + person.amount, 0);

  const pickPerson = (personId: string) => {
    setSelectedId(personId);
    setEdited(null);
  };

  const pickTone = (next: Tone) => {
    setTone(next);
    setEdited(null);
  };

  const handleRewrite = async () => {
    if (!target || rewriting) return;
    setRewriting(true);
    try {
      const message = await rewriteReminder({
        tone,
        name: target.name,
        amountLabel: money(target.amount),
        title,
        payerName: payer?.name,
        draft: reminderText,
      });
      setEdited(message);
    } catch {
      Alert.alert('Could not rewrite', 'Try again in a moment, or edit the message yourself.');
    } finally {
      setRewriting(false);
    }
  };

  const handleWhatsApp = async () => {
    try {
      const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message: shareText });
      }
    } catch {
      Alert.alert('Could not share', 'Please try another option.');
    }
  };

  const handleMessages = async () => {
    try {
      const encoded = encodeURIComponent(shareText);
      const url = Platform.OS === 'ios' ? `sms:&body=${encoded}` : `sms:?body=${encoded}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not share', 'Please try another option.');
    }
  };

  // Feedback shows on the button itself: Alert.alert does nothing on web.
  const showCopyState = (state: 'copied' | 'failed') => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopyState(state);
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2000);
  };

  const handleCopyLink = async () => {
    try {
      // On web this resolves false when the browser refuses; native always resolves true.
      const copied = await Clipboard.setStringAsync(mode === 'share' && link ? link : shareText);
      showCopyState(copied ? 'copied' : 'failed');
    } catch {
      showCopyState('failed');
    }
  };

  const copyLabel =
    copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? "Couldn't copy" : mode === 'share' && link ? 'Copy Link' : 'Copy Text';

  const handleMore = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      Alert.alert('Could not share', 'Please try another option.');
    }
  };

  const channels = (
    <View style={styles.channelRow}>
      <Pressable style={styles.channel} onPress={handleWhatsApp}>
        <View style={[styles.channelCircle, { backgroundColor: WHATSAPP_GREEN }]}>
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        </View>
        <Text style={styles.channelLabel}>WhatsApp</Text>
      </Pressable>
      <Pressable
        style={styles.channel}
        onPress={handleCopyLink}
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
      >
        <View style={[styles.channelCircle, { backgroundColor: copyState === 'copied' ? COPIED_GREEN : PURPLE }]}>
          <Ionicons name={copyState === 'copied' ? 'checkmark' : 'link'} size={22} color="#fff" />
        </View>
        <Text style={styles.channelLabel} accessibilityLiveRegion="polite">
          {copyLabel}
        </Text>
      </Pressable>
      <Pressable style={styles.channel} onPress={handleMessages}>
        <View style={[styles.channelCircle, { backgroundColor: MESSAGES_BLUE }]}>
          <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
        </View>
        <Text style={styles.channelLabel}>Messages</Text>
      </Pressable>
      <Pressable style={styles.channel} onPress={handleMore}>
        <View style={[styles.channelCircle, { backgroundColor: PILL_GRAY }]}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#000" />
        </View>
        <Text style={styles.channelLabel}>More</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              {remindOnly ? (
                <Text style={styles.remindTitle}>Remind</Text>
              ) : (
                <View style={styles.modeSwitch}>
                  {(['share', 'remind'] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: mode === value }}
                      onPress={() => setMode(value)}
                      style={[styles.modeOption, mode === value && styles.modeOptionActive]}
                    >
                      <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>
                        {value === 'share' ? 'Share Bill' : 'Remind'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {mode === 'share' ? (
                <>
                  <Text style={styles.subtitle}>
                    Let friends scan or select a channel below to split {money(total)}
                  </Text>

                  <View style={styles.qrBox}>
                    {creatingLink ? (
                      <View style={styles.qrPlaceholder}>
                        <ActivityIndicator color={PURPLE} />
                        <Text style={styles.qrPlaceholderText}>Creating link…</Text>
                      </View>
                    ) : (
                      <QRCode value={link ?? shareText} size={160} backgroundColor={PURPLE_TINT} />
                    )}
                  </View>
                  <View style={styles.scanCaption}>
                    <Ionicons name="qr-code-outline" size={14} color={PURPLE} />
                    <Text style={styles.scanCaptionText}>
                      {link ? 'Scan to see the bill and mark yourself paid' : 'Scan QR Code to Pay'}
                    </Text>
                  </View>

                  <View style={styles.orRow}>
                    <View style={styles.orDivider} />
                    <Text style={styles.orText}>OR SHARE VIA</Text>
                    <View style={styles.orDivider} />
                  </View>

                  {channels}
                </>
              ) : target ? (
                <>
                  <Text style={styles.subtitle}>
                    {payer
                      ? `Nudge someone who owes ${payer.name}`
                      : 'Pick who to remind, then choose a tone'}
                  </Text>

                  <Text style={styles.sectionLabel}>Who to remind</Text>
                  <View style={styles.chipRow}>
                    {candidates.map((person) => (
                      <Pressable
                        key={person.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: person.id === target.id }}
                        onPress={() => pickPerson(person.id)}
                        style={[styles.chip, person.id === target.id && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, person.id === target.id && styles.chipTextActive]}>
                          {person.name} · {money(person.amount)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>Tone</Text>
                  <View style={styles.chipRow}>
                    {TONES.map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: value === tone }}
                        onPress={() => pickTone(value)}
                        style={[styles.chip, value === tone && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, value === tone && styles.chipTextActive]}>
                          {TONE_LABELS[value]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    accessibilityLabel="Reminder message"
                    style={styles.messageInput}
                    value={reminderText}
                    onChangeText={setEdited}
                    multiline
                    maxLength={600}
                  />

                  {AI_AVAILABLE && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rewrite message with AI"
                      disabled={rewriting}
                      onPress={handleRewrite}
                      style={({ pressed }) => [styles.aiButton, (pressed || rewriting) && styles.pressed]}
                    >
                      {rewriting ? (
                        <ActivityIndicator size="small" color={PURPLE} />
                      ) : (
                        <Ionicons name="sparkles" size={16} color={PURPLE} />
                      )}
                      <Text style={styles.aiButtonText}>Rewrite with AI</Text>
                    </Pressable>
                  )}

                  <View style={styles.orRow}>
                    <View style={styles.orDivider} />
                    <Text style={styles.orText}>SEND VIA</Text>
                    <View style={styles.orDivider} />
                  </View>

                  {channels}
                </>
              ) : (
                <Text style={styles.emptyText}>Nobody still owes anything, so there is no one to remind.</Text>
              )}

              <Pressable style={styles.cancelButton} onPress={close}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  sheetContent: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  remindTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: PILL_GRAY,
    borderRadius: 20,
    padding: 3,
    alignSelf: 'center',
  },
  modeOption: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 18,
  },
  modeOptionActive: {
    backgroundColor: PURPLE,
  },
  modeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  modeTextActive: {
    color: '#fff',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: PILL_GRAY,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: PURPLE,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  chipTextActive: {
    color: '#fff',
  },
  messageInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: '#000',
    textAlignVertical: 'top',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: PURPLE_TINT,
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PURPLE,
  },
  pressed: {
    opacity: 0.65,
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginVertical: 32,
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: PURPLE_TINT,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  qrPlaceholderText: {
    fontSize: 13,
    color: MUTED,
  },
  scanCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 20,
  },
  scanCaptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: PURPLE,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  orDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  orText: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  channel: {
    alignItems: 'center',
    gap: 6,
  },
  channelCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelLabel: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: PILL_GRAY,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
});
