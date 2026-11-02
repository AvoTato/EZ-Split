import { StyleSheet, Text, View } from 'react-native';

import { money, pctOf } from '../lib/format';
import type { ParsedReceipt } from '../lib/parseReceipt';
import type { PersonBreakdown } from '../lib/receiptSession';

const MUTED = '#8A8A8A';

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
  const share = `${Math.round(breakdown.proportion * 100)}% of items`;
  const servicePct = receipt ? pctOf(receipt.serviceCharge, receipt.subtotal) : null;
  const taxPct = receipt ? pctOf(receipt.tax, receipt.subtotal) : null;
  const adjustments = [
    { label: `Discount · ${share}`, value: -breakdown.discount },
    { label: `Service${servicePct ? ` ${servicePct}%` : ''} · ${share}`, value: breakdown.serviceCharge },
    { label: `Tax${taxPct ? ` ${taxPct}%` : ''} · ${share}`, value: breakdown.tax },
    { label: 'Rounding', value: breakdown.rounding },
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

const styles = StyleSheet.create({
  box: {
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E5E5',
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
