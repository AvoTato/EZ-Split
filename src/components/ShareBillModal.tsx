import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { getSettings } from '../lib/settings';
import { billSnapshot, withShareLink } from '../lib/shareBill';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];
const WHATSAPP_GREEN = '#25D366';
const MESSAGES_BLUE = '#007AFF';

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
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, PURPLE_TINT, PURPLE, PILL_GRAY, GREEN } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [chosenMode, setMode] = useState<Mode>('share');
  const mode: Mode = remindOnly ? 'remind' : chosenMode;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>(() => getSettings().tone);
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
      Alert.alert(t('Could not rewrite'), t('Try again in a moment, or edit the message yourself.'));
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
      Alert.alert(t('Could not share'), t('Please try another option.'));
    }
  };

  const handleMessages = async () => {
    try {
      const encoded = encodeURIComponent(shareText);
      const url = Platform.OS === 'ios' ? `sms:&body=${encoded}` : `sms:?body=${encoded}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('Could not share'), t('Please try another option.'));
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
    copyState === 'copied' ? t('Copied!') : copyState === 'failed' ? t("Couldn't copy") : mode === 'share' && link ? t('Copy Link') : t('Copy Text');

  const handleMore = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      Alert.alert(t('Could not share'), t('Please try another option.'));
    }
  };

  const channels = (
    <View style={styles.channelRow}>
      <Pressable style={styles.channel} onPress={handleWhatsApp}>
        <View style={[styles.channelCircle, { backgroundColor: WHATSAPP_GREEN }]}>
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        </View>
        <Text style={styles.channelLabel}>{t('WhatsApp')}</Text>
      </Pressable>
      <Pressable
        style={styles.channel}
        onPress={handleCopyLink}
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
      >
        <View style={[styles.channelCircle, { backgroundColor: copyState === 'copied' ? GREEN : PURPLE }]}>
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
        <Text style={styles.channelLabel}>{t('Messages')}</Text>
      </Pressable>
      <Pressable style={styles.channel} onPress={handleMore}>
        <View style={[styles.channelCircle, { backgroundColor: PILL_GRAY }]}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.INK} />
        </View>
        <Text style={styles.channelLabel}>{t('More')}</Text>
      </Pressable>
    </View>
  );

  const remindChannels = (
    <View style={styles.channelRow}>
      <Pressable style={styles.channel} onPress={handleWhatsApp}>
        <View style={styles.remindCircle}>
          <Ionicons name="chatbubble-outline" size={26} color={PURPLE_DARK} />
        </View>
        <Text style={styles.remindChannelLabel}>{t('WhatsApp')}</Text>
      </Pressable>
      <Pressable style={styles.channel} onPress={handleMessages}>
        <View style={styles.remindCircle}>
          <Ionicons name="chatbubble-outline" size={26} color={PURPLE_DARK} />
        </View>
        <Text style={styles.remindChannelLabel}>{t('Messages')}</Text>
      </Pressable>
      <Pressable style={styles.channel} onPress={handleMore}>
        <View style={styles.remindCircle}>
          <Ionicons name="ellipsis-horizontal" size={26} color={PURPLE_DARK} />
        </View>
        <Text style={styles.remindChannelLabel}>{t('More')}</Text>
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
                <Text style={styles.remindTitle}>{t('Remind')}</Text>
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
                        {value === 'share' ? t('Share Bill') : t('Remind')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {mode === 'share' ? (
                <>
                  <Text style={styles.subtitle}>
                    {t('Let friends scan or select a channel below to split {amount}', { amount: money(total) })}
                  </Text>

                  <View style={styles.qrBox}>
                    {creatingLink ? (
                      <View style={styles.qrPlaceholder}>
                        <ActivityIndicator color={PURPLE} />
                        <Text style={styles.qrPlaceholderText}>{t('Creating link…')}</Text>
                      </View>
                    ) : (
                      <QRCode value={link ?? shareText} size={160} backgroundColor={PURPLE_TINT} />
                    )}
                  </View>
                  <View style={styles.scanCaption}>
                    <Ionicons name="qr-code-outline" size={14} color={PURPLE} />
                    <Text style={styles.scanCaptionText}>
                      {link ? t('Scan to see the bill and mark yourself paid') : t('Scan QR Code to Pay')}
                    </Text>
                  </View>

                  <View style={styles.orRow}>
                    <View style={styles.orDivider} />
                    <Text style={styles.orText}>{t('OR SHARE VIA')}</Text>
                    <View style={styles.orDivider} />
                  </View>

                  {channels}
                </>
              ) : target ? (
                <>
                  <Text style={styles.subtitle}>
                    {payer
                      ? t('Nudge someone who owes {name}', { name: payer.name })
                      : t('Pick who to remind, then choose a tone')}
                  </Text>

                  <Text style={styles.remindLabel}>{t('WHO TO REMIND')}</Text>
                  <View style={styles.remindChipRow}>
                    {candidates.map((person) => {
                      const selected = person.id === target.id;
                      const index = Math.max(0, session.people.findIndex((p) => p.id === person.id));
                      return (
                        <Pressable
                          key={person.id}
                          accessibilityRole="button"
                          accessibilityLabel={t('Remind {name}', { name: person.name })}
                          accessibilityState={{ selected }}
                          onPress={() => pickPerson(person.id)}
                          style={[styles.personChip, selected && styles.personChipActive]}
                        >
                          <View style={[styles.personAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                            <Text style={styles.personAvatarText}>
                              {person.name.trim().charAt(0).toUpperCase() || '?'}
                            </Text>
                          </View>
                          <Text style={styles.personChipText}>{person.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.remindLabel}>{t('TONE')}</Text>
                  <View style={styles.remindChipRow}>
                    {TONES.map((value) => {
                      const selected = value === tone;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => pickTone(value)}
                          style={[styles.toneChip, selected && styles.toneChipActive]}
                        >
                          <Text style={[styles.toneChipText, selected && styles.toneChipTextActive]}>
                            {t(TONE_LABELS[value])}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <TextInput
                    accessibilityLabel={t('Reminder message')}
                    style={styles.remindMessage}
                    value={reminderText}
                    onChangeText={setEdited}
                    multiline
                    maxLength={600}
                  />

                  {AI_AVAILABLE && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Rewrite message with AI')}
                      disabled={rewriting}
                      onPress={handleRewrite}
                      style={({ pressed }) => [styles.rewriteButton, (pressed || rewriting) && styles.pressed]}
                    >
                      {rewriting ? (
                        <ActivityIndicator size="small" color={PURPLE_DARK} />
                      ) : (
                        <Ionicons name="sparkles-outline" size={22} color={PURPLE_DARK} />
                      )}
                      <Text style={styles.rewriteText}>{t('Rewrite with AI')}</Text>
                    </Pressable>
                  )}

                  <View style={styles.orRow}>
                    <View style={styles.orDivider} />
                    <Text style={styles.remindOr}>{t('SEND VIA')}</Text>
                    <View style={styles.orDivider} />
                  </View>

                  {remindChannels}
                </>
              ) : (
                <Text style={styles.emptyText}>{t('Nobody still owes anything, so there is no one to remind.')}</Text>
              )}

              {!(mode === 'remind' && target) && (
                <Pressable style={styles.cancelButton} onPress={close}>
                  <Text style={styles.cancelButtonText}>{t('Cancel')}</Text>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, INK, MUTED, BORDER, PANEL, SURFACE, PILL_GRAY, OVERLAY  }: Colors) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: SURFACE,
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
    color: INK,
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
    color: INK,
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
    color: INK,
  },
  chipTextActive: {
    color: '#fff',
  },
  messageInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: PANEL,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: INK,
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
  remindLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  remindChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 22,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 20,
  },
  personChipActive: {
    backgroundColor: PURPLE_TINT,
    borderColor: PURPLE,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  personChipText: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
  },
  toneChip: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: SURFACE,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  toneChipActive: {
    backgroundColor: PURPLE,
  },
  toneChipText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  toneChipTextActive: {
    color: INK,
  },
  remindMessage: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: PANEL,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    lineHeight: 26,
    color: INK,
    textAlignVertical: 'top',
  },
  rewriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: SURFACE,
    paddingVertical: 18,
  },
  rewriteText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  remindOr: {
    fontSize: 16,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 0.3,
  },
  remindCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindChannelLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
    marginTop: 8,
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
    backgroundColor: BORDER,
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
    color: INK,
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
    color: INK,
  },
});
