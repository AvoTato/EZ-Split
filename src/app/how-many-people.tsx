import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { groupStep } from '../lib/flowSteps';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  setGroupSettlementSetup,
  setSettlementSummarySession,
  setSplitSetup,
  type Person,
  type SettlementPerson,
} from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];
const MAX_PEOPLE = 20;

type SplitMode = 'equal' | 'separate';

function initialOf(name: string, index: number) {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : String(index + 1);
}

export default function HowManyPeopleScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, MUTED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [receipt] = useState<ParsedReceipt | null>(() => getParsedReceipt());
  const [isGroup] = useState(() => (getGroupSettlementSetup()?.members ?? []).length > 0);
  const [mode, setMode] = useState<SplitMode>('equal');
  const nextId = useRef(1000);
  const [people, setPeople] = useState<Person[]>(() => {
    const members = getGroupSettlementSetup()?.members ?? [];
    return members.length > 0
      ? members
      : [
          { id: 'p1', name: 'You' },
          { id: 'p2', name: '' },
        ];
  });

  useEffect(() => {
    if (!receipt) router.replace('/upload-receipt');
  }, [receipt, router]);

  if (!receipt) return null;

  const count = people.length;
  const total = receipt.total ?? 0;

  const setNameAt = (index: number, value: string) =>
    setPeople((prev) => prev.map((person, i) => (i === index ? { ...person, name: value } : person)));
  const removeAt = (index: number) =>
    setPeople((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  const addPerson = () =>
    setPeople((prev) =>
      prev.length >= MAX_PEOPLE ? prev : [...prev, { id: `n${nextId.current++}`, name: '' }],
    );

  const handleContinue = () => {
    const setup = getGroupSettlementSetup();
    if (isGroup && setup) setGroupSettlementSetup({ ...setup, members: people });
    if (mode === 'separate') {
      if (!isGroup) {
        setSplitSetup({
          people: people.map((person, index) => ({ id: `p${index + 1}`, name: person.name.trim() })),
        });
      }
      router.push('/who-had-what');
      return;
    }
    const amountPerPerson = total / count;
    const settlementPeople: SettlementPerson[] = people.map((person, index) => ({
      id: isGroup ? person.id : `e${index + 1}`,
      name: person.name.trim() || t('Person {n}', { n: index + 1 }),
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
            accessibilityLabel={t('Go back')}
            onPress={() => goBack(router)}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View>
            <Text style={styles.stepLabel}>{isGroup ? groupStep(3).label : t('Instant split · Step {n} of 3', { n: 2 })}</Text>
            <Text style={styles.title}>{t('How many people?')}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, isGroup && { width: groupStep(3).fill }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              style={[styles.segment, mode === 'equal' && styles.segmentActive]}
              onPress={() => setMode('equal')}
            >
              <Text style={[styles.segmentText, mode === 'equal' && styles.segmentTextActive]}>{t('Split equally')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.segment, mode === 'separate' && styles.segmentActive]}
              onPress={() => setMode('separate')}
            >
              <Text style={[styles.segmentText, mode === 'separate' && styles.segmentTextActive]}>{t('Split separately')}</Text>
            </Pressable>
          </View>

          <View style={styles.countCard}>
            <View>
              <Text style={styles.countLabel}>{t('Number of people')}</Text>
              <Text style={styles.countValue}>{count}</Text>
            </View>
          </View>

          {mode === 'equal' && (
            <View style={styles.payCard}>
              <View>
                <Text style={styles.payTitle}>{t('Each person pays')}</Text>
                <Text style={styles.paySub}>
                  {money(total)} ÷ {count}
                </Text>
              </View>
              <Text style={styles.payAmount}>{money(total / count)}</Text>
            </View>
          )}

          <Text style={styles.namesHeading}>{t('NAMES (OPTIONAL)')}</Text>
          {people.map((person, index) => (
            <View key={person.id} style={styles.nameRow}>
              <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={styles.avatarText}>{initialOf(person.name, index)}</Text>
              </View>
              <TextInput
                style={styles.nameInput}
                value={person.name}
                onChangeText={(value) => setNameAt(index, value)}
                placeholder={t('Person {n}', { n: index + 1 })}
                placeholderTextColor={MUTED}
                editable={!isGroup}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {people.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Remove {name}', { name: person.name.trim() || t('Person {n}', { n: index + 1 }) })}
                  onPress={() => removeAt(index)}
                  hitSlop={8}
                  style={styles.removeButton}
                >
                  <Ionicons name="close" size={24} color={MUTED} />
                </Pressable>
              )}
            </View>
          ))}

          {!isGroup && (
            <Pressable
              accessibilityRole="button"
              onPress={addPerson}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={26} color={PURPLE_DARK} />
              <Text style={styles.addButtonText}>{t('Add a member')}</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueText}>{t('Continue')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, PANEL, BG, SURFACE  }: Colors) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
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
    backgroundColor: SURFACE,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 64,
    marginTop: 8,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: PURPLE,
  },
  addButtonText: { fontSize: 20, fontWeight: '800', color: PURPLE_DARK },
  pressed: { opacity: 0.85 },
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
    color: ON_PURPLE,
  },
  paySub: {
    fontSize: 15,
    color: ON_PURPLE,
    marginTop: 2,
  },
  payAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: ON_PURPLE,
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
  removeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: SURFACE,
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
    color: ON_PURPLE,
  },
});
