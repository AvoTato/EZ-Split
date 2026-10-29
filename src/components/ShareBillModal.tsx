import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
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
import { money } from '../lib/format';
import type { SettlementSummarySession } from '../lib/receiptSession';
import { TONES, TONE_LABELS, buildReminder, type Tone } from '../lib/reminders';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#F1EDFD';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';
const WHATSAPP_GREEN = '#25D366';
const MESSAGES_BLUE = '#007AFF';

function buildShareText(session: SettlementSummarySession) {
  const lines = session.people.map((person) => `${person.name}: ${money(person.amount)}`);
  const total = session.people.reduce((sum, person) => sum + person.amount, 0);
  return ['Settlement Summary', ...lines, `Total: ${money(total)}`].join('\n');
}

type Props = {
  visible: boolean;
  onClose: () => void;
  session: SettlementSummarySession;
  title?: string;
  remindOnly?: boolean;
};

type Mode = 'share' | 'remind';

const AI_AVAILABLE = Boolean(process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_TOKEN);

export default function ShareBillModal({ visible, onClose, session, title, remindOnly = false }: Props) {
  const [chosenMode, setMode] = useState<Mode>('share');
  const mode: Mode = remindOnly ? 'remind' : chosenMode;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>('friendly');
  const [edited, setEdited] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState(false);

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

  const shareText = mode === 'remind' ? reminderText : buildShareText(session);
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

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(shareText);
      Alert.alert('Copied', 'Share text copied to clipboard.');
    } catch {
      Alert.alert('Could not share', 'Please try another option.');
    }
  };

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
      <Pressable style={styles.channel} onPress={handleCopyLink}>
        <View style={[styles.channelCircle, { backgroundColor: PURPLE }]}>
          <Ionicons name="link" size={22} color="#fff" />
        </View>
        <Text style={styles.channelLabel}>Copy Link</Text>
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
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
                    <QRCode value={shareText} size={160} backgroundColor={PURPLE_TINT} />
                  </View>
                  <View style={styles.scanCaption}>
                    <Ionicons name="qr-code-outline" size={14} color={PURPLE} />
                    <Text style={styles.scanCaptionText}>Scan QR Code to Pay</Text>
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

              <Pressable style={styles.cancelButton} onPress={onClose}>
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
