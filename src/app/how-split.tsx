import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { money, pctOf } from '../lib/format';
import { goBack } from '../lib/navigation';
import { getParsedReceipt, getSettlementSummarySession } from '../lib/receiptSession';
import type { SettlementPerson } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT, t } from '../lib/i18n';

const AVATAR_COLORS = ['#5B3FD8', '#0F766E', '#B45309', '#C2185B', '#0369A1', '#7C3AED'];

const list = (names: string[]) =>
  names.length <= 1
    ? names.join('')
    : t('{list} and {last}', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] });

function plainWords(person: SettlementPerson, count: number, total: number, hasFees: boolean) {
  const breakdown = person.breakdown;
  if (!breakdown) {
    const fees = hasFees ? ` ${t('Service charge and tax are already included in the total.')}` : '';
    return `${t('The bill was split equally among {n} people, so each person pays {amount}.', { n: count, amount: money(total / count) })}${fees}`;
  }
  const items = breakdown.items
    .filter((item) => item.cost > 0)
    .map((item) => (item.shares < item.outOf ? t('{shares} of {outOf} portions of {name}', { shares: item.shares, outOf: item.outOf, name: item.name }) : item.name));
  const fees = [
    breakdown.discount !== 0 ? t('discount') : null,
    breakdown.serviceCharge !== 0 ? t('service charge') : null,
    breakdown.tax !== 0 ? t('tax') : null,
  ].filter((fee): fee is string => fee !== null);
  const had = items.length > 0 ? t('{name} had {list}.', { name: person.name, list: list(items) }) : t('{name} had no dishes.', { name: person.name });
  if (fees.length === 0) return had;
  const subject = list(fees);
  return `${had} ${fees.length > 1 ? t('{subject} are shared in proportion to what they had.', { subject: subject[0].toUpperCase() + subject.slice(1) }) : t('{subject} is shared in proportion to what they had.', { subject: subject[0].toUpperCase() + subject.slice(1) })}`;
}

export default function HowSplitScreen() {
  const t = useT();
  const colors = useColors();
  const { PURPLE_DARK, INK } = colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        label: item.shares < item.outOf ? `${item.name} · ${t('{shares} of {outOf} portions', { shares: item.shares, outOf: item.outOf })}` : item.name,
        value: money(item.cost),
      }),
    );
  }

  const feeRows: { label: string; value: string }[] = [];
  if (breakdown) {
    feeRows.push({ label: t('Items'), value: money(breakdown.itemsSubtotal) });
    if (breakdown.discount !== 0)
      feeRows.push({ label: `${t('Discount')} · ${t('on their items')}`, value: `- ${money(breakdown.discount)}` });
    if (breakdown.serviceCharge !== 0)
      feeRows.push({
        label: `${t('Service')}${servicePct !== null ? ` ${servicePct}%` : ''} · ${t('on their items')}`,
        value: `+ ${money(breakdown.serviceCharge)}`,
      });
    if (breakdown.tax !== 0)
      feeRows.push({
        label: `${t('SST')}${taxPct !== null ? ` ${taxPct}%` : ''} · ${t('on their items')}`,
        value: `+ ${money(breakdown.tax)}`,
      });
    feeRows.push({ label: t('Rounding'), value: money(breakdown.rounding) });
  } else {
    feeRows.push({ label: t('Bill total'), value: money(total) });
    feeRows.push({ label: t('Split equally'), value: `÷ ${people.length}` });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Go back')} onPress={() => goBack(router)} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={INK} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerTitle}>{t('How this was split')}</Text>
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
                {t('{name}’s share', { name: person.name })}
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
              <Text style={styles.paysLabel}>{t('{name} pays', { name: person.name })}</Text>
              <Text style={styles.paysValue}>{money(person.amount)}</Text>
            </View>
          </View>

          <View style={styles.plain}>
            <Ionicons name="sparkles-outline" size={24} color={PURPLE_DARK} />
            <View style={styles.plainCopy}>
              <Text style={styles.plainTitle}>{t('In plain words')}</Text>
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
            <Text style={styles.doneText}>{t('Done')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ PURPLE_DARK, PURPLE_TINT, PURPLE, ON_PURPLE, INK, MUTED, BORDER, BG, SURFACE  }: Colors) =>
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
    backgroundColor: SURFACE,
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
    color: ON_PURPLE,
  },
  card: {
    marginTop: 24,
    backgroundColor: SURFACE,
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
    color: ON_PURPLE,
  },
  pressed: {
    opacity: 0.85,
  },
});
