import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { money, pctOf } from '../lib/format';
import { goBack } from '../lib/navigation';
import { groupStep } from '../lib/flowSteps';
import type { ParsedReceipt } from '../lib/parseReceipt';
import {
  getGroupSettlementSetup,
  getParsedReceipt,
  getSplitSetup,
  setWhoHadWhatSession,
  type ItemAssignment,
  type Person,
} from '../lib/receiptSession';
import { computeSettlement, totalSharesByItem } from '../lib/settlement';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

type View_ = 'dish' | 'person';

const FRACTIONS: Record<string, string> = {
  '1/2': '½',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/4': '¼',
  '3/4': '¾',
  '1/5': '⅕',
  '1/6': '⅙',
  '1/8': '⅛',
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function fractionLabel(numerator: number, denominator: number) {
  const divisor = gcd(numerator, denominator) || 1;
  const n = numerator / divisor;
  const d = denominator / divisor;
  if (n === d) return '';
  const key = `${n}/${d}`;
  return FRACTIONS[key] ?? key;
}

function initialOf(name: string, index: number) {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : String(index + 1);
}

const colorOf = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

export default function WhoHadWhatScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK, MUTED, AMBER, RED } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [view, setView] = useState<View_>('dish');
  const nextPersonId = useRef(1);
  const isGroup = Boolean(getGroupSettlementSetup());

  useEffect(() => {
    const stored = getParsedReceipt();
    if (!stored) {
      router.replace('/upload-receipt');
      return;
    }
    const groupMembers = getGroupSettlementSetup()?.members ?? [];
    if (groupMembers.length > 0) {
      setPeople((prev) => (prev.length === 0 ? groupMembers : prev));
      nextPersonId.current = groupMembers.length + 1;
    } else {
      const carried = getSplitSetup()?.people ?? [];
      if (carried.length > 0) {
        setPeople((prev) => (prev.length === 0 ? carried : prev));
        nextPersonId.current = carried.length + 1;
      }
    }
    setReceipt(stored);
  }, [router]);

  if (!receipt) return null;

  const totalShares = totalSharesByItem(receipt, assignments);
  const assignedCount = totalShares.filter((shares) => shares > 0).length;
  const { settlementPeople } = computeSettlement(receipt, people, assignments);

  const isAssigned = (personId: string, itemIndex: number) =>
    assignments.some((a) => a.personId === personId && a.itemIndex === itemIndex && a.shares > 0);

  const assignedPeopleCount = (itemIndex: number) =>
    assignments.filter((a) => a.itemIndex === itemIndex && a.shares > 0).length;

  const addPerson = () => {
    const taken = new Set(people.map((p) => p.id));
    let id = `p${nextPersonId.current}`;
    while (taken.has(id)) {
      nextPersonId.current += 1;
      id = `p${nextPersonId.current}`;
    }
    nextPersonId.current += 1;
    setPeople((prev) => [...prev, { id, name: '' }]);
    if (view === 'person') setExpandedPersonId(id);
  };

  const updatePersonName = (personId: string, name: string) =>
    setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, name } : p)));

  const removePerson = (personId: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== personId));
    setAssignments((prev) => prev.filter((a) => a.personId !== personId));
    setExpandedPersonId((prev) => (prev === personId ? null : prev));
  };

  const toggleExpanded = (personId: string) =>
    setExpandedPersonId((prev) => (prev === personId ? null : personId));

  const toggleItemForPerson = (personId: string, itemIndex: number) => {
    setAssignments((prev) => {
      const exists = prev.some((a) => a.personId === personId && a.itemIndex === itemIndex);
      if (exists) {
        return prev.filter((a) => !(a.personId === personId && a.itemIndex === itemIndex));
      }
      return [...prev, { itemIndex, personId, shares: 1 }];
    });
  };

  const handleNext = () => {
    setWhoHadWhatSession({ people, assignments });
    router.push('/item-quantities');
  };

  const servicePct = pctOf(receipt.serviceCharge, receipt.subtotal);
  const taxPct = pctOf(receipt.tax, receipt.subtotal);
  const subtitleParts = [
    receipt.subtotal !== null ? `${t('Subtotal')} ${money(receipt.subtotal)}` : null,
    receipt.serviceCharge !== null ? `+${servicePct !== null ? `${servicePct}% ` : ''}${t('service')}` : null,
    receipt.tax !== null ? `+${taxPct !== null ? `${taxPct}% ` : ''}${t('SST')}` : null,
  ].filter((part): part is string => part !== null);


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
            <Text style={styles.stepLabel}>{isGroup ? groupStep(3).label : t('Instant split · Step {n} of 3', { n: 2 })}</Text>
            <Text style={styles.title}>{t('Who had what?')}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, isGroup && { width: groupStep(3).fill }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.receiptCard}>
            <View style={styles.receiptIcon}>
              <Ionicons name="receipt-outline" size={26} color={PURPLE_DARK} />
            </View>
            <View style={styles.receiptCopy}>
              <Text style={styles.receiptTitle}>{t('Receipt')}</Text>
              {subtitleParts.length > 0 && <Text style={styles.receiptSub}>{subtitleParts.join(' · ')}</Text>}
            </View>
            {receipt.total !== null && <Text style={styles.receiptTotal}>{money(receipt.total)}</Text>}
          </View>

          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              style={[styles.segment, view === 'dish' && styles.segmentActive]}
              onPress={() => setView('dish')}
            >
              <Text style={[styles.segmentText, view === 'dish' && styles.segmentTextActive]}>{t('By dish')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.segment, view === 'person' && styles.segmentActive]}
              onPress={() => setView('person')}
            >
              <Text style={[styles.segmentText, view === 'person' && styles.segmentTextActive]}>{t('By person')}</Text>
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <Ionicons name="warning-outline" size={24} color={AMBER} />
            <Text style={styles.statusText}>
              {t('{n} of {total} dishes assigned · tap a name to add or remove', { n: assignedCount, total: receipt.items.length })}
            </Text>
          </View>

          {view === 'dish' &&
            receipt.items.map((item, itemIndex) => {
              const ways = assignedPeopleCount(itemIndex);
              const unit = item.qty > 0 ? item.price / item.qty : item.price;
              return (
                <View key={itemIndex} style={styles.card}>
                  <View style={styles.dishTop}>
                    <View style={styles.dishCopy}>
                      <Text style={styles.dishName}>{item.name}</Text>
                      <Text style={styles.dishSub}>
                        {item.qty} × {unit.toFixed(2)}
                        {ways > 1 ? ` · ${t('split {n} ways', { n: ways })}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.dishPrice}>{money(item.price)}</Text>
                  </View>
                  <View style={styles.circles}>
                    {people.map((person, personIndex) => {
                      const on = isAssigned(person.id, itemIndex);
                      return (
                        <Pressable
                          key={person.id}
                          accessibilityRole="button"
                          accessibilityLabel={t('{name} had {item}', { name: person.name.trim() || t('Person {n}', { n: personIndex + 1 }), item: item.name })}
                          accessibilityState={{ selected: on }}
                          onPress={() => toggleItemForPerson(person.id, itemIndex)}
                          style={[styles.circle, on ? { backgroundColor: colorOf(personIndex) } : styles.circleOff]}
                        >
                          <Text style={[styles.circleText, !on && styles.circleTextOff]}>
                            {initialOf(person.name, personIndex)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

          {view === 'person' &&
            people.map((person, personIndex) => {
              const expanded = expandedPersonId === person.id;
              const mine = assignments.filter((a) => a.personId === person.id && a.shares > 0);
              const amount = settlementPeople.find((p) => p.id === person.id)?.amount ?? 0;
              return (
                <View key={person.id} style={styles.card}>
                  <View style={styles.personTop}>
                    <View style={[styles.personAvatar, { backgroundColor: colorOf(personIndex) }]}>
                      <Text style={styles.personAvatarText}>{initialOf(person.name, personIndex)}</Text>
                    </View>
                    <TextInput
                      style={styles.personName}
                      value={person.name}
                      onChangeText={(text) => updatePersonName(person.id, text)}
                      placeholder={t('Person {n}', { n: personIndex + 1 })}
                      placeholderTextColor={MUTED}
                      editable={!isGroup}
                      numberOfLines={1}
                    />
                    <Text style={styles.personAmount} numberOfLines={1}>
                      {money(amount)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={expanded ? t('Done editing dishes for {name}', { name: person.name.trim() || t('Person {n}', { n: personIndex + 1 }) }) : t('Edit dishes for {name}', { name: person.name.trim() || t('Person {n}', { n: personIndex + 1 }) })}
                      onPress={() => toggleExpanded(person.id)}
                      hitSlop={8}
                    >
                      <Text style={styles.editLink} numberOfLines={1}>
                        {expanded ? t('Done') : t('Edit dishes')}
                      </Text>
                    </Pressable>
                  </View>

                  {expanded ? (
                    <View style={styles.checklist}>
                      {receipt.items.map((item, itemIndex) => {
                        const checked = isAssigned(person.id, itemIndex);
                        return (
                          <Pressable
                            key={itemIndex}
                            style={styles.checkRow}
                            onPress={() => toggleItemForPerson(person.id, itemIndex)}
                          >
                            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                              {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </View>
                            <Text style={styles.checkName}>
                              {item.qty > 1 ? `${item.qty}× ${item.name}` : item.name}
                            </Text>
                            <Text style={styles.checkPrice}>{money(item.price)}</Text>
                          </Pressable>
                        );
                      })}
                      {!isGroup && people.length > 1 && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('Remove {name}', { name: person.name.trim() || t('Person {n}', { n: personIndex + 1 }) })}
                          onPress={() => removePerson(person.id)}
                          style={styles.removeRow}
                        >
                          <Ionicons name="trash-outline" size={18} color={RED} />
                          <Text style={styles.removeText}>{t('Remove person')}</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : mine.length > 0 ? (
                    <View style={styles.chips}>
                      {mine.map((a) => {
                        const item = receipt.items[a.itemIndex];
                        const divisor = Math.max(totalShares[a.itemIndex], item.qty, 1);
                        const fraction = fractionLabel(a.shares, divisor);
                        return (
                          <View key={a.itemIndex} style={styles.chip}>
                            <Text style={styles.chipText}>
                              {item.name}
                              {fraction ? ` ${fraction}` : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noDishes}>{t('No dishes yet')}</Text>
                  )}
                </View>
              );
            })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.personButton, pressed && styles.pressed]}
            onPress={addPerson}
          >
            <Ionicons name="add" size={24} color={PURPLE_DARK} />
            <Text style={styles.personButtonText}>{t('Person')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.nextButton,
              people.length === 0 && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={handleNext}
            disabled={people.length === 0}
          >
            <Text style={styles.nextText}>{t('Next · Review split')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, TRACK, PANEL, BG, SURFACE, AMBER, RED  }: Colors) =>
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
    gap: 14,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: PANEL,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  receiptIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCopy: {
    flex: 1,
  },
  receiptTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
  },
  receiptSub: {
    fontSize: 15,
    color: MUTED,
  },
  receiptTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: AMBER,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  dishTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dishCopy: {
    flex: 1,
  },
  dishName: {
    fontSize: 21,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.4,
  },
  dishSub: {
    fontSize: 16,
    color: MUTED,
    marginTop: 1,
  },
  dishPrice: {
    fontSize: 21,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  circles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOff: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: MUTED,
    backgroundColor: SURFACE,
  },
  circleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  circleTextOff: {
    color: MUTED,
  },
  personTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  personName: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
    padding: 0,
    margin: 0,
  },
  personAmount: {
    minWidth: 76,
    textAlign: 'right',
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
  editLink: {
    fontSize: 15,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: PURPLE_TINT,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  noDishes: {
    fontSize: 16,
    color: MUTED,
    marginTop: 14,
  },
  checklist: {
    marginTop: 12,
    gap: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: PURPLE,
  },
  checkName: {
    flex: 1,
    fontSize: 17,
    color: INK,
  },
  checkPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  removeText: {
    fontSize: 16,
    fontWeight: '700',
    color: RED,
  },
  footer: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  personButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: SURFACE,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  nextButton: {
    flex: 1.6,
    borderRadius: 18,
    backgroundColor: PURPLE,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 18,
    fontWeight: '800',
    color: ON_PURPLE,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
