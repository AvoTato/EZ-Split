import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ReceiptDetectedCard from '../components/ReceiptDetectedCard';
import ReceiptEditor from '../components/ReceiptEditor';
import { goBack } from '../lib/navigation';
import type { ParsedReceipt } from '../lib/parseReceipt';
import { applyPatch, checkReceipt, type ReceiptPatch } from '../lib/receiptReview';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  setParsedReceipt,
} from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_DARK = '#5B3FD8';
const INK = '#1A1530';
const MUTED = '#6B6880';
const BORDER = '#E6E3F0';
const TRACK = '#EFECF8';

export default function InstantSettlementScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const stored = getParsedReceipt();
    if (!stored) {
      router.replace('/upload-receipt');
      return;
    }
    setIsGroup((getGroupSettlementSetup()?.members ?? []).length > 0);
    setReceipt(stored);
  }, [router]);

  if (!receipt) return null;

  const warningCount = checkReceipt(receipt).filter((issue) => issue.severity === 'warning').length;

  // Edits are written straight back to the session so every later screen (and the
  // receipt saved to history) sees the corrected receipt.
  const handlePatch = (patch: ReceiptPatch) => {
    setReceipt((prev) => {
      if (!prev) return prev;
      const next = applyPatch(prev, patch);
      setParsedReceipt(next);
      return next;
    });
  };

  const handleContinue = () => {
    router.push('/how-many-people');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBack(router)}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View style={styles.headerCopy}>
            {!isGroup && <Text style={styles.stepLabel}>Instant split · Step 1 of 3</Text>}
            <Text style={styles.headerTitle}>{isGroup ? 'Group Settlement' : 'Check your receipt'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit receipt"
            onPress={() => setEditing(true)}
            style={styles.pencil}
          >
            <Ionicons name="pencil-outline" size={22} color={PURPLE_DARK} />
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {editing ? (
            <ReceiptEditor
              receipt={receipt}
              onPatch={handlePatch}
              onDone={() => setEditing(false)}
            />
          ) : (
            <ReceiptDetectedCard
              receipt={receipt}
              onEditPress={() => setEditing(true)}
              issueCount={warningCount}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {editing ? (
            <Pressable style={styles.doneButton} onPress={() => setEditing(false)}>
              <Text style={styles.doneButtonText}>Done editing</Text>
            </Pressable>
          ) : (
            <View style={styles.footerRow}>
              <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
                <Text style={styles.editButtonText}>Edit items</Text>
              </Pressable>
              <Pressable style={styles.doneButton} onPress={handleContinue}>
                <Text style={styles.doneButtonText}>Looks good</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerCopy: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.6,
  },
  pencil: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  progressFill: {
    width: '33.333%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 14,
  },
  editButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: '#fff',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  doneButton: {
    flex: 1.7,
    backgroundColor: PURPLE,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
});
