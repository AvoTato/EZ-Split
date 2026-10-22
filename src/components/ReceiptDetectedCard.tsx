import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { ParsedReceipt } from '../lib/parseReceipt';

const GREEN = '#2E7D32';
const MUTED = '#8A8A8A';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function pctOf(part: number | null, whole: number | null) {
  if (part === null || whole === null || whole === 0) return null;
  return Math.round((part / whole) * 100);
}

export default function ReceiptDetectedCard({ receipt }: { receipt: ParsedReceipt }) {
  const taxPct = pctOf(receipt.tax, receipt.subtotal);
  const servicePct = pctOf(receipt.serviceCharge, receipt.subtotal);

  return (
    <View style={styles.card}>
      <View style={styles.detectedRow}>
        <Ionicons name="checkmark" size={16} color={GREEN} />
        <Text style={styles.detectedText}>Receipt detected</Text>
      </View>

      {receipt.needsReview && (
        <Text style={styles.reviewText}>
          Some amounts may not have been read correctly. Please check the items against your receipt.
        </Text>
      )}

      {receipt.items.map((item, index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.rowText}>{item.qty > 1 ? `${item.qty}× ${item.name}` : item.name}</Text>
          <Text style={styles.rowTextBold}>{money(item.price)}</Text>
        </View>
      ))}

      <View style={styles.divider} />

      {receipt.tax !== null && (
        <View style={styles.row}>
          <Text style={styles.mutedText}>SST{taxPct !== null ? ` (${taxPct}%)` : ''}</Text>
          <Text style={styles.mutedText}>{money(receipt.tax)}</Text>
        </View>
      )}

      {receipt.serviceCharge !== null && (
        <View style={styles.row}>
          <Text style={styles.mutedText}>
            Service Charge{servicePct !== null ? ` (${servicePct}%)` : ''}
          </Text>
          <Text style={styles.mutedText}>{money(receipt.serviceCharge)}</Text>
        </View>
      )}

      {receipt.total !== null && (
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalText}>Total</Text>
          <Text style={styles.totalText}>{money(receipt.total)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  detectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: GREEN,
  },
  reviewText: {
    color: '#B45309',
    fontSize: 13,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowText: {
    fontSize: 15,
    color: '#000',
  },
  rowTextBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  mutedText: {
    fontSize: 14,
    color: MUTED,
  },
  totalRow: {
    marginTop: 4,
  },
  totalText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
});
