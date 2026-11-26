import { StyleSheet, Text, View } from 'react-native';

import { useMemo } from 'react';
import { money, pctOf } from '../lib/format';
import type { ParsedReceipt } from '../lib/parseReceipt';
import type { PersonBreakdown } from '../lib/receiptSession';
import { useColors, type Colors } from '../lib/theme';
import { useT } from '../lib/i18n';


function portionLabel(name: string, shares: number, outOf: number) {
  if (shares >= outOf) return name;
  return `${name} (${shares}/${outOf})`;
}

export default function SplitBreakdown({
  breakdown,
  receipt,
}: {
  breakdown: PersonBreakdown;
  // Used for the service/tax rates; omitted when the receipt is no longer available.
  receipt: ParsedReceipt | null;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const share = t('{n}% of items', { n: Math.round(breakdown.proportion * 100) });
  const servicePct = receipt ? pctOf(receipt.serviceCharge, receipt.subtotal) : null;
  const taxPct = receipt ? pctOf(receipt.tax, receipt.subtotal) : null;
  const adjustments = [
    { label: `${t('Discount')} · ${share}`, value: -breakdown.discount },
    { label: `${t('Service')}${servicePct ? ` ${servicePct}%` : ''} · ${share}`, value: breakdown.serviceCharge },
    { label: `${t('Tax')}${taxPct ? ` ${taxPct}%` : ''} · ${share}`, value: breakdown.tax },
    { label: t('Rounding'), value: breakdown.rounding },
  ].filter((row) => row.value !== 0);

  return (
    <View style={styles.box}>
      {breakdown.items.map((item, index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.label}>{portionLabel(item.name, item.shares, item.outOf)}</Text>
          <Text style={styles.value}>{money(item.cost)}</Text>
        </View>
      ))}
      {adjustments.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>
            {row.value > 0 ? '+' : ''}
            {money(row.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ MUTED, BORDER  }: Colors) =>
  StyleSheet.create({
  box: {
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: BORDER,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: MUTED,
  },
  value: {
    fontSize: 13,
    color: MUTED,
  },
});
