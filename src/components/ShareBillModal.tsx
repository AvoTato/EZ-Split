import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Alert, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { SettlementSummarySession } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_TINT = '#F1EDFD';
const PILL_GRAY = '#EFEFEF';
const MUTED = '#8A8A8A';
const WHATSAPP_GREEN = '#25D366';
const MESSAGES_BLUE = '#007AFF';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function buildShareText(session: SettlementSummarySession) {
  const lines = session.people.map((person) => `${person.name}: ${money(person.amount)}`);
  const total = session.people.reduce((sum, person) => sum + person.amount, 0);
  return ['Settlement Summary', ...lines, `Total: ${money(total)}`].join('\n');
}

type Props = {
  visible: boolean;
  onClose: () => void;
  session: SettlementSummarySession;
};

export default function ShareBillModal({ visible, onClose, session }: Props) {
  const shareText = buildShareText(session);
  const total = session.people.reduce((sum, person) => sum + person.amount, 0);

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Share Bill</Text>
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

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 6,
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
