import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../lib/navigation';
import { groupStep } from '../lib/flowSteps';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  getWhoHadWhatSession,
  setSettlementSummarySession,
  type ItemAssignment,
  type Person,
} from '../lib/receiptSession';
import { computeSettlement, itemShareCost, totalSharesByItem } from '../lib/settlement';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

export default function ItemQuantitiesScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);

  useEffect(() => {
    const storedReceipt = getParsedReceipt();
    if (!storedReceipt) {
      router.replace('/upload-receipt');
      return;
    }
    const storedSession = getWhoHadWhatSession();
    if (!storedSession) {
      router.replace('/who-had-what');
      return;
    }
    setReceipt(storedReceipt);
    setPeople(storedSession.people);
    setAssignments(storedSession.assignments);
  }, [router]);

  if (!receipt || !people) return null;

  const getPersonAssignments = (personId: string) =>
    assignments.filter((a) => a.personId === personId && a.shares > 0);

  const totalShares = totalSharesByItem(receipt, assignments);
  const getItemLiveCost = (itemIndex: number, shares: number) =>
    itemShareCost(receipt.items[itemIndex], shares, totalShares[itemIndex]);

  const incrementShare = (personId: string, itemIndex: number) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.personId === personId && a.itemIndex === itemIndex ? { ...a, shares: a.shares + 1 } : a
      )
    );
  };

  const decrementShare = (personId: string, itemIndex: number) => {
    setAssignments((prev) => {
      const current = prev.find((a) => a.personId === personId && a.itemIndex === itemIndex);
      if (!current) return prev;
      if (current.shares <= 1) {
        return prev.filter((a) => !(a.personId === personId && a.itemIndex === itemIndex));
      }
      return prev.map((a) =>
        a.personId === personId && a.itemIndex === itemIndex ? { ...a, shares: a.shares - 1 } : a
      );
    });
  };

  const handleCalculate = () => {
    const { settlementPeople, unassignedItems } = computeSettlement(receipt, people, assignments);
    setSettlementSummarySession({
      people: settlementPeople,
      note: 'Shared items split by portion; discount, tax and service by what each person had.',
      unassignedItems: unassignedItems.length > 0 ? unassignedItems : undefined,
    });
    router.push('/settlement-summary');
  };

  const isGroup = Boolean(getGroupSettlementSetup());

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
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
            <Text style={styles.stepLabel}>{isGroup ? groupStep(3).label : t('Step {n} of 3', { n: 2 })}</Text>
            <Text style={styles.headerTitle}>{t('How many did they have?')}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, isGroup && { width: groupStep(3).fill }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.banner}>
            <Ionicons name="information-circle-outline" size={26} color={PURPLE_DARK} />
            <Text style={styles.bannerText}>{t('Shared items are split by portion. Service charge and tax follow what each person had.')}</Text>
          </View>

          {people.map((person, index) => {
            const personAssignments = getPersonAssignments(person.id);
            const label = person.name.trim() || t('Person {n}', { n: index + 1 });
            const subtotal = personAssignments.reduce(
              (sum, a) => sum + getItemLiveCost(a.itemIndex, a.shares),
              0
            );

            return (
              <View key={person.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                    <Text style={styles.avatarText}>{person.name.trim().charAt(0).toUpperCase() || index + 1}</Text>
                  </View>
                  <Text style={styles.personLabel} numberOfLines={1}>
                    {label}
                  </Text>
                  <View style={styles.subtotalBlock}>
                    <Text style={styles.subtotalLabel}>{t('Subtotal')}</Text>
                    <Text style={styles.subtotalValue}>{money(subtotal)}</Text>
                  </View>
                </View>

                {personAssignments.length === 0 ? (
                  <Text style={styles.noItemsText}>{t('No items selected')}</Text>
                ) : (
                  <View style={styles.selectedList}>
                    {personAssignments.map((a, rowIndex) => {
                      const item = receipt.items[a.itemIndex];
                      return (
                        <View key={a.itemIndex} style={[styles.selectedRow, rowIndex > 0 && styles.selectedRowDivided]}>
                          <View style={styles.itemCopy}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemEach}>
                              {t('{amount} each', { amount: money(itemShareCost(item, 1, totalShares[a.itemIndex])) })}
                            </Text>
                          </View>
                          <View style={styles.stepper}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t('Fewer {item} for {name}', { item: item.name, name: label })}
                              style={styles.minus}
                              onPress={() => decrementShare(person.id, a.itemIndex)}
                              hitSlop={6}
                            >
                              <Ionicons name="remove" size={20} color={INK} />
                            </Pressable>
                            <Text style={styles.stepperCount}>{a.shares}</Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t('More {item} for {name}', { item: item.name, name: label })}
                              style={styles.plus}
                              onPress={() => incrementShare(person.id, a.itemIndex)}
                              hitSlop={6}
                            >
                              <Ionicons name="add" size={20} color={colors.ON_PURPLE} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.calculateButton, pressed && styles.pressed]}
            onPress={handleCalculate}
          >
            <Text style={styles.calculateButtonText}>{t('Calculate')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, BG, SURFACE  }: Colors) =>
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
  headerTitle: {
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
    gap: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: PURPLE_TINT,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  bannerText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    color: INK,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  personLabel: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
  },
  subtotalBlock: {
    alignItems: 'flex-end',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
  },
  subtotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
  },
  noItemsText: {
    fontSize: 16,
    color: MUTED,
    marginTop: 12,
  },
  selectedList: {
    marginTop: 10,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
  },
  selectedRowDivided: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  itemCopy: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  itemEach: {
    fontSize: 15,
    color: MUTED,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    minWidth: 14,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  calculateButton: {
    backgroundColor: PURPLE,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: ON_PURPLE,
  },
  pressed: {
    opacity: 0.85,
  },
});
