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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { money } from '../lib/format';
import { goBack } from '../lib/navigation';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  setSettlementSummarySession,
  setSplitSetup,
  type Person,
  type SettlementPerson,
} from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_DARK = '#5B3FD8';
const PURPLE_TINT = '#F0ECFD';
const INK = '#1A1530';
const MUTED = '#6B6880';
const BORDER = '#E6E3F0';
const TRACK = '#EFECF8';
const PANEL = '#F8F7FB';
const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];
const MAX_PEOPLE = 20;

type SplitMode = 'equal' | 'separate';

function initialOf(name: string, index: number) {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : String(index + 1);
}

export default function HowManyPeopleScreen() {
  const router = useRouter();
  const [receipt] = useState<ParsedReceipt | null>(() => getParsedReceipt());
  const [members] = useState<Person[]>(() => getGroupSettlementSetup()?.members ?? []);
  const [mode, setMode] = useState<SplitMode>('equal');
  const [count, setCount] = useState(() => Math.max(2, members.length));
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!receipt) router.replace('/upload-receipt');
  }, [receipt, router]);

  if (!receipt) return null;

  const isGroup = members.length > 0;
  const total = receipt.total ?? 0;
  const rows = Array.from({ length: count }, (_, index) => index);
  const nameAt = (index: number) => (isGroup ? members[index]?.name ?? '' : names[index] ?? '');

  const setNameAt = (index: number, value: string) =>
    setNames((prev) => {
      const next = [...prev];
      while (next.length <= index) next.push('');
      next[index] = value;
      return next;
    });

  const handleContinue = () => {
    if (mode === 'separate') {
      if (!isGroup) {
        const people: Person[] = rows.map((index) => ({ id: `p${index + 1}`, name: nameAt(index).trim() }));
        setSplitSetup({ people });
      }
      router.push('/who-had-what');
      return;
    }
    const amountPerPerson = total / count;
    const settlementPeople: SettlementPerson[] = rows.map((index) => ({
      id: members[index]?.id ?? `e${index + 1}`,
      name: nameAt(index).trim() || `Person ${index + 1}`,
      amount: amountPerPerson,
    }));
    setSettlementSummarySession({
      pax: count,
      people: settlementPeople,
      note: `Total split equally among ${count} people.`,
    });
    router.push('/settlement-summary');
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
          <View>
            {!isGroup && <Text style={styles.stepLabel}>Instant split · Step 2 of 3</Text>}
            <Text style={styles.title}>{isGroup ? 'Group Settlement' : 'How many people?'}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              style={[styles.segment, mode === 'equal' && styles.segmentActive]}
              onPress={() => setMode('equal')}
            >
              <Text style={[styles.segmentText, mode === 'equal' && styles.segmentTextActive]}>
                Split equally
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.segment, mode === 'separate' && styles.segmentActive]}
              onPress={() => setMode('separate')}
            >
              <Text style={[styles.segmentText, mode === 'separate' && styles.segmentTextActive]}>
                Split separately
              </Text>
            </Pressable>
          </View>

          <View style={styles.countCard}>
            <View>
              <Text style={styles.countLabel}>Number of people</Text>
              <Text style={styles.countValue}>{count}</Text>
            </View>
            {!isGroup && (
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fewer people"
                  style={styles.minus}
                  onPress={() => setCount((value) => Math.max(1, value - 1))}
                >
                  <Ionicons name="remove" size={24} color={INK} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More people"
                  style={styles.plus}
                  onPress={() => setCount((value) => Math.min(MAX_PEOPLE, value + 1))}
                >
                  <Ionicons name="add" size={24} color={INK} />
                </Pressable>
              </View>
            )}
          </View>

          {mode === 'equal' && (
            <View style={styles.payCard}>
              <View>
                <Text style={styles.payTitle}>Each person pays</Text>
                <Text style={styles.paySub}>
                  {money(total)} ÷ {count}
                </Text>
              </View>
              <Text style={styles.payAmount}>{money(total / count)}</Text>
            </View>
          )}

          <Text style={styles.namesHeading}>NAMES (OPTIONAL)</Text>
          {rows.map((index) => (
            <View key={index} style={styles.nameRow}>
              <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={styles.avatarText}>{initialOf(nameAt(index), index)}</Text>
              </View>
              <TextInput
                style={styles.nameInput}
                value={nameAt(index)}
                onChangeText={(value) => setNameAt(index, value)}
                placeholder={`Person ${index + 1}`}
                placeholderTextColor={MUTED}
                editable={!isGroup}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
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
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.6,
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
    width: '66.666%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: PURPLE,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: PURPLE_TINT,
    borderRadius: 24,
    padding: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: '#fff',
    borderColor: BORDER,
  },
  segmentText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  segmentTextActive: {
    color: INK,
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PANEL,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 22,
    paddingHorizontal: 22,
    marginTop: 16,
  },
  countLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: MUTED,
  },
  countValue: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
    color: INK,
  },
  stepper: {
    flexDirection: 'row',
    gap: 8,
  },
  minus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PURPLE,
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  payTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  paySub: {
    fontSize: 15,
    color: INK,
    marginTop: 2,
  },
  payAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: INK,
    letterSpacing: -1,
  },
  namesHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: MUTED,
    letterSpacing: 0.3,
    marginTop: 24,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    fontSize: 18,
    color: INK,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  continueButton: {
    backgroundColor: PURPLE,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
});
