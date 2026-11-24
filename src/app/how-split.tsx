import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { money, pctOf } from '../lib/format';
import { goBack } from '../lib/navigation';
import { getParsedReceipt, getSettlementSummarySession } from '../lib/receiptSession';
import type { SettlementPerson } from '../lib/receiptSession';

const PURPLE = '#9B87F0';
const PURPLE_DARK = '#5B3FD8';
const PURPLE_TINT = '#F0ECFD';
const INK = '#1A1530';
const MUTED = '#6B6880';
const BORDER = '#E6E3F0';
const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

const list = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

function plainWords(person: SettlementPerson, count: number, total: number, hasFees: boolean) {
  const breakdown = person.breakdown;
  if (!breakdown) {
    const fees = hasFees ? ' Service charge and tax are already included in the total.' : '';
    return `The bill was split equally among ${count} ${count === 1 ? 'person' : 'people'}, so each person pays ${money(total / count)}.${fees}`;
  }
  const items = breakdown.items
    .filter((item) => item.cost > 0)
    .map((item) => (item.shares < item.outOf ? `${item.shares} of ${item.outOf} portions of ${item.name}` : item.name));
  const fees = [
    breakdown.discount !== 0 ? 'discount' : null,
    breakdown.serviceCharge !== 0 ? 'service charge' : null,
    breakdown.tax !== 0 ? 'tax' : null,
  ].filter((fee): fee is string => fee !== null);
  const had = items.length > 0 ? `${person.name} had ${list(items)}.` : `${person.name} had no dishes.`;
  if (fees.length === 0) return had;
  const subject = list(fees);
  return `${had} ${subject[0].toUpperCase()}${subject.slice(1)} ${fees.length > 1 ? 'are' : 'is'} shared in proportion to what they had.`;
}

export default function HowSplitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ personId?: string; title?: string }>();
  const [session] = useState(() => getSettlementSummarySession());
  const [receipt] = useState(() => getParsedReceipt());
  const [selectedId, setSelectedId] = useState(params.personId ?? '');

  useEffect(() => {
    if (!session) router.replace('/instant-settlement');
  }, [session, router]);

  if (!session || session.people.length === 0) return null;

  const people = session.people;
  const selectedIndex = Math.max(
    0,
    people.findIndex((person) => person.id === selectedId),
  );
  const person = people[selectedIndex];
  const breakdown = person.breakdown;
  const total = people.reduce((sum, p) => sum + p.amount, 0);
  const servicePct = receipt ? pctOf(receipt.serviceCharge, receipt.subtotal) : null;
  const taxPct = receipt ? pctOf(receipt.tax, receipt.subtotal) : null;
  const hasFees = Boolean(receipt && (receipt.serviceCharge !== null || receipt.tax !== null));
  const title = params.title ? `${params.title} · ${person.name}` : person.name;

  const rows: { label: string; value: string; strong?: boolean }[] = [];
  if (breakdown) {
    breakdown.items.forEach((item) =>
      rows.push({
        label: item.shares < item.outOf ? `${item.name} · ${item.shares} of ${item.outOf} portions` : item.name,
        value: money(item.cost),
      }),
    );
  }

  const feeRows: { label: string; value: string }[] = [];
  if (breakdown) {
    feeRows.push({ label: 'Items', value: money(breakdown.itemsSubtotal) });
    if (breakdown.discount !== 0)
      feeRows.push({ label: 'Discount · on their items', value: `- ${money(breakdown.discount)}` });
    if (breakdown.serviceCharge !== 0)
      feeRows.push({
        label: `Service${servicePct !== null ? ` ${servicePct}%` : ''} · on their items`,
        value: `+ ${money(breakdown.serviceCharge)}`,
      });
    if (breakdown.tax !== 0)
      feeRows.push({
        label: `SST${taxPct !== null ? ` ${taxPct}%` : ''} · on their items`,
        value: `+ ${money(breakdown.tax)}`,
      });
    feeRows.push({ label: 'Rounding', value: money(breakdown.rounding) });
  } else {
    feeRows.push({ label: 'Bill total', value: money(total) });
    feeRows.push({ label: 'Split equally', value: `÷ ${people.length}` });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerTitle}>How this was split</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.chips}>
            {people.map((p, index) => {
              const selected = index === selectedIndex;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedId(p.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{p.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[selectedIndex % AVATAR_COLORS.length] }]}>
                <Text style={styles.avatarText}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {person.name}’s share
              </Text>
            </View>

            {rows.map((row, index) => (
              <View key={index} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
            {rows.length > 0 && <View style={styles.divider} />}
            {feeRows.map((row, index) => (
              <View key={index} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.paysRow}>
              <Text style={styles.paysLabel}>{person.name} pays</Text>
              <Text style={styles.paysValue}>{money(person.amount)}</Text>
            </View>
          </View>

          <View style={styles.plain}>
            <Ionicons name="sparkles-outline" size={24} color={PURPLE_DARK} />
            <View style={styles.plainCopy}>
              <Text style={styles.plainTitle}>In plain words</Text>
              <Text style={styles.plainText}>{plainWords(person, people.length, total, hasFees)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => goBack(router)}
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
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
  eyebrow: {
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: PURPLE,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  chipSelected: {
    backgroundColor: PURPLE,
  },
  chipText: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE_DARK,
  },
  chipTextSelected: {
    color: INK,
  },
  card: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
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
  cardTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
  },
  rowLabel: {
    flex: 1,
    fontSize: 18,
    color: MUTED,
  },
  rowValue: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },
  paysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  paysLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
  },
  paysValue: {
    fontSize: 36,
    fontWeight: '800',
    color: PURPLE_DARK,
    letterSpacing: -1,
  },
  plain: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    backgroundColor: PURPLE_TINT,
    borderRadius: 24,
    padding: 18,
  },
  plainCopy: {
    flex: 1,
  },
  plainTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: INK,
  },
  plainText: {
    fontSize: 18,
    lineHeight: 26,
    color: INK,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  doneButton: {
    backgroundColor: PURPLE,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  pressed: {
    opacity: 0.85,
  },
});
