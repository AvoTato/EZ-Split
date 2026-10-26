import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ParsedReceipt } from '../lib/parseReceipt';

const PURPLE = '#9B87F0';
const GREEN = '#2E7D32';
const MUTED = '#8A8A8A';
const AMBER = '#B45309';

function money(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function pctOf(part: number | null, whole: number | null) {
  if (part === null || whole === null || whole === 0) return null;
  return Math.round((part / whole) * 100);
}

export default function ReceiptDetectedCard({
  receipt,
  onEditPress,
  issueCount = 0,
}: {
  receipt: ParsedReceipt;
  // Omitted on read-only views (e.g. receipt history), which hides the edit button.
  onEditPress?: () => void;
  // Warnings from checkReceipt; only shown alongside the edit button.
  issueCount?: number;
}) {
  const taxPct = pctOf(receipt.tax, receipt.subtotal);
  const servicePct = pctOf(receipt.serviceCharge, receipt.subtotal);

  return (
    <View style={styles.card}>
      <View style={styles.detectedRow}>
        <Ionicons name="checkmark" size={16} color={GREEN} />
        <Text style={styles.detectedText}>Receipt detected</Text>
      </View>

      {receipt.needsReview && !onEditPress && (
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

      {receipt.discount !== null && (
        <View style={styles.row}>
          <Text style={styles.mutedText}>Discount</Text>
          <Text style={styles.mutedText}>−{money(receipt.discount)}</Text>
        </View>
      )}

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

      {onEditPress && issueCount > 0 && (
        <View style={styles.issueRow}>
          <Ionicons name="warning-outline" size={16} color={AMBER} />
          <Text style={styles.issueText}>
            {issueCount === 1 ? '1 thing doesn’t add up' : `${issueCount} things don’t add up`}
          </Text>
        </View>
      )}

      {onEditPress && (
        <Pressable style={styles.editButton} onPress={onEditPress} hitSlop={8}>
          <Ionicons name="create-outline" size={16} color={PURPLE} />
          <Text style={styles.editButtonText}>Something missing?</Text>
        </Pressable>
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
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  issueText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PURPLE,
  },
});
